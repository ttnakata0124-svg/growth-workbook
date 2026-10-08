import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuestions } from "@/lib/data";
import type { AnswerContent, Attempt, Chapter, Course } from "@/lib/types";
import { Workbook } from "./workbook";

export default async function WorkPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const supabase = await createClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("*, course:courses(*)")
    .eq("id", chapterId)
    .eq("is_published", true)
    .is("archived_at", null)
    .maybeSingle();
  if (!chapter) notFound();
  const course = chapter.course as Course;
  if (!course.is_published || course.archived_at) notFound();

  // 進行中のセッションを再開、なければ新規作成（完了済みの章なら再挑戦）
  const { data: attempt, error } = await supabase.rpc("start_attempt", { p_chapter_id: chapterId });
  if (error || !attempt) notFound();

  const [questions, { data: answers }] = await Promise.all([
    getQuestions(chapterId),
    supabase.from("answers").select("question_id, content, updated_at").eq("attempt_id", (attempt as Attempt).id),
  ]);

  const initial: Record<string, { content: AnswerContent; updatedAt: string }> = {};
  for (const a of answers ?? []) initial[a.question_id] = { content: a.content as AnswerContent, updatedAt: a.updated_at };

  return (
    <Workbook
      course={{ id: course.id, title: course.title }}
      chapter={chapter as Chapter}
      attempt={attempt as Attempt}
      questions={questions}
      initialAnswers={initial}
    />
  );
}
