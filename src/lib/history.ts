import "server-only";
import { createClient } from "./supabase/server";
import type { AnswerContent, Attempt, Chapter, Course, Question, QuestionConfig, QuestionType } from "./types";

export type HistoryItem = {
  questionId: string;
  prompt: string;
  description: string;
  type: QuestionType;
  config: QuestionConfig;
  sortOrder: number;
  content?: AnswerContent;
};

// 回答セッション1件分の設問と回答。設問は回答時点のスナップショットを優先して表示する。
export async function getAttemptDetail(attemptId: string) {
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt) return null;
  const [{ data: chapter }, { data: answers }, { data: questions }] = await Promise.all([
    supabase.from("chapters").select("*, course:courses(*)").eq("id", attempt.chapter_id).maybeSingle(),
    supabase.from("answers").select("question_id, content, question_snapshot, updated_at").eq("attempt_id", attemptId),
    supabase.from("questions").select("*").eq("chapter_id", attempt.chapter_id).order("sort_order"),
  ]);
  if (!chapter) return null;

  const items = new Map<string, HistoryItem>();
  // 現在の設問（回答していない設問も「未回答」として出すため）。ただし完了後に追加された設問は除く。
  for (const q of (questions ?? []) as Question[]) {
    if (q.archived_at) continue;
    if (attempt.completed_at && new Date(q.created_at) > new Date(attempt.completed_at)) continue;
    items.set(q.id, {
      questionId: q.id,
      prompt: q.prompt,
      description: q.description,
      type: q.question_type,
      config: q.config,
      sortOrder: q.sort_order,
    });
  }
  for (const a of answers ?? []) {
    const snap = a.question_snapshot as Partial<{ prompt: string; description: string; question_type: QuestionType; config: QuestionConfig; sort_order: number }>;
    const current = items.get(a.question_id);
    items.set(a.question_id, {
      questionId: a.question_id,
      prompt: snap.prompt ?? current?.prompt ?? "",
      description: snap.description ?? current?.description ?? "",
      type: snap.question_type ?? current?.type ?? "free_text",
      config: snap.config ?? current?.config ?? {},
      sortOrder: current?.sortOrder ?? snap.sort_order ?? 0,
      content: a.content as AnswerContent,
    });
  }
  return {
    attempt: attempt as Attempt,
    chapter: chapter as Chapter & { course: Course },
    items: [...items.values()].sort((x, y) => x.sortOrder - y.sortOrder),
  };
}

export async function getMyHistory() {
  const supabase = await createClient();
  const [{ data: attempts }, { data: answered }] = await Promise.all([
    supabase.from("attempts").select("*, chapter:chapters(*, course:courses(*))").order("started_at", { ascending: false }),
    supabase.from("answers").select("attempt_id"),
  ]);
  const withAnswers = new Set((answered ?? []).map((a) => a.attempt_id));
  return ((attempts ?? []) as (Attempt & { chapter: Chapter & { course: Course } })[]).filter(
    (a) => a.status === "completed" || withAnswers.has(a.id),
  );
}
