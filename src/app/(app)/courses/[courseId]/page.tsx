import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyAttempts, getMyCourse } from "@/lib/data";
import { ProgressBar, StatusBadge } from "@/components/status-badge";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const [course, attempts] = await Promise.all([getMyCourse(courseId), getMyAttempts()]);
  if (!course) notFound();

  const latestCompleted = new Map<string, string>();
  for (const a of attempts) if (a.status === "completed") latestCompleted.set(a.chapter_id, a.id);

  return (
    <main>
      <Link href="/" className="text-sm text-muted">← 教材一覧</Link>
      <h1 className="mt-2 text-xl font-bold leading-snug text-navy">{course.title}</h1>
      {course.description && <p className="mt-2 text-sm text-muted">{course.description}</p>}
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar percent={course.percent} />
        <span className="shrink-0 text-sm font-bold text-navy">
          {course.completed}/{course.total}章・{course.percent}%
        </span>
      </div>

      <ul className="mt-6 space-y-3">
        {course.chapters.map((ch) => {
          const doneAttempt = latestCompleted.get(ch.id);
          return (
            <li key={ch.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gold">第{ch.chapter_number}章</p>
                  <h2 className="font-bold leading-snug text-navy">{ch.title}</h2>
                  {ch.completedCount > 1 && <p className="mt-0.5 text-xs text-muted">{ch.completedCount}回 完了</p>}
                </div>
                <StatusBadge status={ch.status} />
              </div>
              <div className="mt-3 flex gap-2">
                {ch.status === "completed" ? (
                  <>
                    {doneAttempt && (
                      <Link href={`/history/${doneAttempt}`} className="btn btn-outline btn-sm flex-1">過去の回答を見る</Link>
                    )}
                    <Link href={`/work/${ch.id}`} className="btn btn-primary btn-sm flex-1">
                      {ch.hasInProgress ? "再挑戦を続ける" : "もう一度ワークを行う"}
                    </Link>
                  </>
                ) : (
                  <Link href={`/work/${ch.id}`} className="btn btn-primary btn-sm flex-1">
                    {ch.status === "in_progress" ? "続きから再開" : "ワークを始める"}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
