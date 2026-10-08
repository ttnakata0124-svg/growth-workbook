import "server-only";
import { createClient } from "./supabase/server";
import type { ChapterStatus } from "./types";

// 管理者用。回答本文を参照しない集計関数だけを使う。
export type AdminProgressRow = {
  user_id: string;
  full_name: string;
  email: string;
  role: "employee" | "admin";
  is_active: boolean;
  course_id: string;
  course_title: string;
  completed_chapters: number;
  total_chapters: number;
  progress_percent: number;
  status: ChapterStatus;
  last_activity_at: string | null;
};

export async function getAdminProgress(): Promise<AdminProgressRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_progress");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminProgressRow[];
}
