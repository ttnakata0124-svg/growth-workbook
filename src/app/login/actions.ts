"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUserByCode } from "@/lib/login-code";
import { findDeviceLogin, forgetDevice, hasPin, isValidPin, PIN_MAX_FAILURES, registerDevice, verifyPin } from "@/lib/pin";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください。" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "メールアドレスまたはパスワードが正しくありません。" };

  // ログインコードを設定済みなら、この端末で次回からコードだけで入れるようにする。
  // パスワードでログインできた本人なので、コードの入力ミス回数もリセットする。
  await forgetDevice();
  if (await hasPin(data.user.id)) {
    await createAdminClient().from("login_pins").update({ failed_count: 0 }).eq("user_id", data.user.id);
    await registerDevice(data.user.id);
  }
  redirect("/");
}

export async function pinLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const pin = String(formData.get("pin") ?? "");
  if (!isValidPin(pin)) return { error: "6桁の数字を入力してください。" };

  const device = await findDeviceLogin();
  if (!device?.pinHash) redirect("/login?mode=password");
  if (device.failedCount >= PIN_MAX_FAILURES) {
    return { error: "コードを続けて間違えたため、コードでのログインを止めています。メールアドレスとパスワードでログインしてください。" };
  }

  const admin = createAdminClient();
  if (!verifyPin(pin, device.pinHash)) {
    const failed = device.failedCount + 1;
    await admin.from("login_pins").update({ failed_count: failed }).eq("user_id", device.userId);
    const left = PIN_MAX_FAILURES - failed;
    return {
      error: left > 0
        ? `コードが正しくありません（あと${left}回まちがえると、コードでのログインが止まります）。`
        : "コードを続けて間違えたため、コードでのログインを止めています。メールアドレスとパスワードでログインしてください。",
    };
  }

  await Promise.all([
    admin.from("login_pins").update({ failed_count: 0 }).eq("user_id", device.userId),
    admin.from("login_devices").update({ last_used_at: new Date().toISOString() }).eq("id", device.deviceId),
  ]);

  return signInAs(device.userId);
}

export async function codeLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "");
  if (!isValidPin(code)) return { error: "6桁の数字を入力してください。" };
  const found = await findUserByCode(code);
  if (!found.ok) {
    return {
      error: found.reason === "locked"
        ? "ログインの失敗が続いたため、しばらくコードでのログインを止めています。時間をおいてやり直してください。"
        : "コードが正しくありません。",
    };
  }
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role, is_active")
    .eq("id", found.userId)
    .maybeSingle();
  // コードだけで入れるのは利用中の一般社員のみ（管理者はメールアドレスとパスワード）
  if (!profile?.is_active || profile.role !== "employee") return { error: "コードが正しくありません。" };
  return signInAs(found.userId);
}

// メールは送らずにワンタイムトークンを発行し、その場で検証してセッションを作る。
async function signInAs(userId: string): Promise<LoginState> {
  const failed = { error: "ログインできませんでした。管理者にお問い合わせください。" };
  const admin = createAdminClient();
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const email = user.user?.email;
  if (!email) return failed;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) return failed;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (error) return failed;
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
