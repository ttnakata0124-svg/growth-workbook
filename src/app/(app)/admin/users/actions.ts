"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "employee";
  if (!fullName || !email) return { error: "氏名とメールアドレスを入力してください。" };
  if (password.length < 8) return { error: "初期パスワードは8文字以上にしてください。" };

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
  if (role === "admin") {
    const supabase = await createClient();
    await supabase.from("profiles").update({ role }).eq("id", data.user.id);
  }
  revalidatePath("/admin", "layout");
  return { ok: `${fullName} さんのアカウントを作成しました。メールアドレスと初期パスワードを本人に伝えてください。` };
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
