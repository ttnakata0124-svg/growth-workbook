import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/data";
import type { Chapter, ChapterProgressRow, Course, Profile } from "@/lib/types";
import { ProgressBar, StatusBadge } from "@/components/status-badge";
import { isPlaceholderEmail } from "@/lib/login-code";

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const [{ data: profile }, { data: courses }, { data: chapters }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("courses").select("*").eq("is_published", true).is("archived_at", null).order("sort_order"),
    supabase.from("chapters").select("*").eq("is_published", true).is("archived_at", null).order("sort_order"),
    // 回答本文は含まない（状態・回数・日時のみ）
    supabase.rpc("chapter_progress", { p_user_id: userId }),
  ]);
  if (!profile) notFound();
  const p = profile as Profile;
  const byChapter = new Map(((progress ?? []) as ChapterProgressRow[]).map((r) => [r.chapter_id, r]));

  return (
    <main>
      <Link href="/admin" className="text-sm text-muted">← 学習進捗</Link>
      <h1 className="mt-2 text-xl font-bold text-navy">{p.full_name || p.email}</h1>
      <p className="text-sm text-muted">{isPlaceholderEmail(p.email) ? "コードでログイン" : p.email}</p>
      <p className="mt-2 rounded-lg bg-soft px-3 py-2 text-xs text-muted">回答内容はプライバシー保護のため表示されません。</p>

      {((courses ?? []) as Course[]).map((course) => {
        const chs = ((chapters ?? []) as Chapter[]).filter((c) => c.course_id === course.id);
        const done = chs.filter((c) => byChapter.get(c.id)?.status === "completed").length;
        const percent = chs.length ? Math.floor((done * 100) / chs.length) : 0;
        return (
          <section key={course.id} className="card mt-4 p-4">
            <h2 className="font-bold leading-snug text-navy">{course.title}</h2>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar percent={percent} />
              <span className="shrink-0 text-sm font-bold">{done}/{chs.length}章・{percent}%</span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {chs.map((c) => {
                const r = byChapter.get(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">第{c.chapter_number}章：{c.title}</p>
                      <p className="text-xs text-muted">
                        {r?.last_completed_at ? `完了 ${formatDate(r.last_completed_at)}` : r?.last_activity_at ? `最終 ${formatDate(r.last_activity_at)}` : "—"}
                        {r && r.completed_count > 1 ? `・${r.completed_count}回完了` : ""}
                      </p>
                    </div>
                    <StatusBadge status={r?.status ?? "not_started"} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
