"use server";

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
