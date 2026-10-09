"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // メールは送らずにワンタイムトークンを発行し、その場で検証してセッションを作る。
  const { data: user } = await admin.auth.admin.getUserById(device.userId);
  const email = user.user?.email;
  if (!email) return { error: "ログインできませんでした。メールアドレスとパスワードでログインしてください。" };
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) {
    return { error: "ログインできませんでした。メールアドレスとパスワードでログインしてください。" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (error) return { error: "ログインできませんでした。メールアドレスとパスワードでログインしてください。" };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
