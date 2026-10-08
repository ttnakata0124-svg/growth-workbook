import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

// 現在のユーザーとプロフィール。未ログインならログイン画面へ。
export const getCurrentProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, created_at")
    .eq("id", auth.user.id)
    .single();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  return profile as Profile;
});

// 管理者でなければホームへ。権限判定は必ずサーバー側で行う。
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
