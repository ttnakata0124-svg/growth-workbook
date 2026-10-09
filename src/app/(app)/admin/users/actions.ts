"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";
import { issueLoginCode, PLACEHOLDER_EMAIL_DOMAIN, revokeLoginCode } from "@/lib/login-code";

export type FormState = { error?: string; ok?: string; code?: string };

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "employee";
  let email = String(formData.get("email") ?? "").trim().toLowerCase();
  let password = String(formData.get("password") ?? "");
  if (!fullName) return { error: "氏名を入力してください。" };
  if (role === "admin" || email) {
    if (!email) return { error: "管理者はメールアドレスが必要です。" };
    if (password.length < 8) return { error: "初期パスワードは8文字以上にしてください。" };
  } else {
    // メールアドレスなしの社員：ログインはコードだけ。内部用のアドレスとパスワードを付ける。
    email = `u-${randomBytes(8).toString("hex")}@${PLACEHOLDER_EMAIL_DOMAIN}`;
    password = randomBytes(24).toString("base64url");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    return { error: error?.message.includes("already") ? "このメールアドレスは既に登録されています。" : "アカウントを作成できませんでした。" };
  }
  revalidatePath("/admin", "layout");
  if (role === "admin") {
    const supabase = await createClient();
    await supabase.from("profiles").update({ role }).eq("id", data.user.id);
    return { ok: `${fullName} さんの管理者アカウントを作成しました。メールアドレスと初期パスワードを本人に伝えてください。` };
  }
  const code = await issueLoginCode(data.user.id);
  if (!code) return { error: `${fullName} さんのアカウントは作成しましたが、ログインコードを発行できませんでした。一覧から「ログインコードを再発行」してください。` };
  return { ok: `${fullName} さんのアカウントを作成しました。下のログインコードを本人に伝えてください（この画面を閉じると再表示できません）。`, code };
}

export async function reissueCode(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = String(formData.get("user_id"));
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", userId).maybeSingle();
  if (!profile || profile.role !== "employee") return { error: "ログインコードは一般社員にだけ発行できます。" };
  const code = await issueLoginCode(userId);
  if (!code) return { error: "ログインコードを発行できませんでした。" };
  return { ok: `${profile.full_name} さんの新しいログインコードです。以前のコードは使えなくなりました。`, code };
}

export async function updateUser(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("user_id"));
  const op = String(formData.get("op"));
  const supabase = await createClient();
  const admin = createAdminClient();

  if (op === "rename") {
    const fullName = String(formData.get("full_name") ?? "").trim();
    if (fullName) await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
  } else if (op === "role") {
    if (userId === me.id) return;
    const role = formData.get("role") === "admin" ? "admin" : "employee";
    await supabase.from("profiles").update({ role }).eq("id", userId);
    // 管理者はコードだけではログインできないようにする
    if (role === "admin") await revokeLoginCode(userId);
  } else if (op === "deactivate" || op === "activate") {
    if (userId === me.id) return;
    const active = op === "activate";
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", userId);
    if (!error) {
      // ログイン自体も止める（再開時は解除）
      await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    }
  } else if (op === "password") {
    const password = String(formData.get("password") ?? "");
    if (password.length >= 8) await admin.auth.admin.updateUserById(userId, { password });
  }
  revalidatePath("/admin", "layout");
}
