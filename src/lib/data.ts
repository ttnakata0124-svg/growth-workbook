import "server-only";
import { createClient } from "./supabase/server";
import type { Attempt, Chapter, ChapterProgressRow, ChapterStatus, Course, Question } from "./types";

export type ChapterWithStatus = Chapter & {
  status: ChapterStatus;
  completedCount: number;
  hasInProgress: boolean;
  lastActivityAt: string | null;
};

export type CourseWithProgress = Course & {
  chapters: ChapterWithStatus[];
  completed: number;
  total: number;
  percent: number;
  status: ChapterStatus;
  nextChapter: ChapterWithStatus | null;
};

// 公開中の教材・章と、本人の進捗
export async function getMyCourses(): Promise<CourseWithProgress[]> {
  const supabase = await createClient();
  const [{ data: courses }, { data: chapters }, { data: progress }] = await Promise.all([
    supabase.from("courses").select("*").eq("is_published", true).is("archived_at", null).order("sort_order"),
    supabase.from("chapters").select("*").eq("is_published", true).is("archived_at", null).order("sort_order"),
    supabase.rpc("chapter_progress"),
  ]);
  const byChapter = new Map<string, ChapterProgressRow>(
    ((progress ?? []) as ChapterProgressRow[]).map((p) => [p.chapter_id, p]),
  );
  return ((courses ?? []) as Course[]).map((course) => {
    const chs: ChapterWithStatus[] = ((chapters ?? []) as Chapter[])
      .filter((c) => c.course_id === course.id)
      .map((c) => {
        const p = byChapter.get(c.id);
        return {
          ...c,
          status: p?.status ?? "not_started",
          completedCount: p?.completed_count ?? 0,
          hasInProgress: p?.has_in_progress ?? false,
          lastActivityAt: p?.last_activity_at ?? null,
        };
      });
    return summarize(course, chs);
  });
}

export function summarize(course: Course, chapters: ChapterWithStatus[]): CourseWithProgress {
  const total = chapters.length;
  const completed = chapters.filter((c) => c.status === "completed").length;
  const percent = total === 0 ? 0 : Math.floor((completed * 100) / total);
  const started = chapters.some((c) => c.status !== "not_started");
  const status: ChapterStatus = total > 0 && completed === total ? "completed" : started ? "in_progress" : "not_started";
  const nextChapter =
    chapters.find((c) => c.status === "in_progress") ?? chapters.find((c) => c.status === "not_started") ?? null;
  return { ...course, chapters, completed, total, percent, status, nextChapter };
}

export async function getMyCourse(courseId: string): Promise<CourseWithProgress | null> {
  const courses = await getMyCourses();
  return courses.find((c) => c.id === courseId) ?? null;
}

export async function getQuestions(chapterId: string): Promise<Question[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("chapter_id", chapterId)
    .is("archived_at", null)
    .order("sort_order");
  return (data ?? []) as Question[];
}

export async function getMyAttempts(chapterId?: string): Promise<Attempt[]> {
  const supabase = await createClient();
  let query = supabase.from("attempts").select("*").order("started_at", { ascending: true });
  if (chapterId) query = query.eq("chapter_id", chapterId);
  const { data } = await query;
  return (data ?? []) as Attempt[];
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return d.toLocaleString("ja-JP", opts);
}

export function chapterLabel(c: Pick<Chapter, "chapter_number" | "title">): string {
  return `第${c.chapter_number}章：${c.title}`;
}
