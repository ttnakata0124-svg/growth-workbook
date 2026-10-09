"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { hashPin, forgetDevice, isValidPin, registerDevice } from "@/lib/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string; ok?: boolean };

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください。" };
  if (password !== confirm) return { error: "確認用のパスワードが一致しません。" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "パスワードを変更できませんでした。" };
  return { ok: true };
}

export type PinState = { error?: string; ok?: string };

export async function setLoginPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const profile = await getCurrentProfile();
  const pin = String(formData.get("pin") ?? "");
  const confirm = String(formData.get("pin_confirm") ?? "");
  if (!isValidPin(pin)) return { error: "ログインコードは6桁の数字にしてください。" };
  if (pin !== confirm) return { error: "確認用のコードが一致しません。" };
  const { error } = await createAdminClient()
    .from("login_pins")
    .upsert({ user_id: profile.id, pin_hash: hashPin(pin), failed_count: 0, updated_at: new Date().toISOString() });
  if (error) return { error: "ログインコードを設定できませんでした。" };
  await registerDevice(profile.id);
  revalidatePath("/account");
  return { ok: "ログインコードを設定しました。この端末では次回から6桁のコードだけでログインできます。" };
}

export async function removeLoginPin() {
  const profile = await getCurrentProfile();
  const admin = createAdminClient();
  await forgetDevice();
  await admin.from("login_devices").delete().eq("user_id", profile.id);
  await admin.from("login_pins").delete().eq("user_id", profile.id);
  revalidatePath("/account");
}
