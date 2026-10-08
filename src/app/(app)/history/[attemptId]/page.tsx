import Link from "next/link";
import { notFound } from "next/navigation";
import { chapterLabel, formatDate } from "@/lib/data";
import { getAttemptDetail } from "@/lib/history";
import { AnswerView } from "@/components/answer/answer-view";

export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ attemptId }, { done }] = await Promise.all([params, searchParams]);
  const detail = await getAttemptDetail(attemptId);
  if (!detail) notFound();
  const { attempt, chapter, items } = detail;
  let regular = 0;

  return (
    <main>
      {done && (
        <div className="mb-5 rounded-2xl border-2 border-gold bg-gold-soft/60 p-5 text-center">
          <p className="text-lg font-bold text-navy">第{chapter.chapter_number}章を完了しました</p>
          <p className="mt-1 text-sm">おつかれさまでした。決意したことを、今日から実行していきましょう。</p>
          <Link href={`/courses/${chapter.course_id}`} className="btn btn-primary mt-4 w-full">章の一覧へ戻る</Link>
        </div>
      )}
      <Link href="/history" className="text-sm text-muted">← 回答履歴</Link>
      <p className="mt-2 text-xs text-muted">{chapter.course.title}</p>
      <h1 className="text-xl font-bold leading-snug text-navy">{chapterLabel(chapter)}</h1>
      <p className="mt-1 text-sm text-muted">
        {attempt.attempt_number}回目・実施日 {formatDate(attempt.completed_at ?? attempt.started_at)}
        {attempt.status === "in_progress" && "（途中）"}
      </p>
      {attempt.status === "in_progress" && (
        <Link href={`/work/${chapter.id}`} className="btn btn-primary mt-3 w-full">続きから回答する</Link>
      )}

      <ol className="mt-5 space-y-4">
        {items.map((item) => {
          const label = item.type === "commitment" ? "実行への決意" : `Q${++regular}`;
          return (
            <li key={item.questionId} className="card p-4">
              <p className="text-xs font-bold text-gold">{label}</p>
              <h2 className="mt-0.5 font-bold leading-relaxed">{item.prompt}</h2>
              <div className="mt-3 border-t border-line pt-3">
                <AnswerView type={item.type} config={item.config} content={item.content} />
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
