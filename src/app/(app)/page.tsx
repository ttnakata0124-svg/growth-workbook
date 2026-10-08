import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { getMyCourses } from "@/lib/data";
import { ProgressBar } from "@/components/status-badge";

export default async function HomePage() {
  const [profile, courses] = await Promise.all([getCurrentProfile(), getMyCourses()]);
  return (
    <main>
      <section className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-gold">{APP_NAME}</p>
        <h1 className="mt-1 text-xl font-bold text-navy">{profile.full_name || "ようこそ"} さんのワーク</h1>
      </section>

      {courses.length === 0 && <p className="card p-6 text-center text-muted">公開中の教材はまだありません。</p>}

      <ul className="space-y-4">
        {courses.map((course) => {
          const cta =
            course.status === "completed"
              ? { label: "振り返る", href: `/courses/${course.id}` }
              : course.status === "in_progress"
                ? { label: "続きから再開", href: course.nextChapter ? `/work/${course.nextChapter.id}` : `/courses/${course.id}` }
                : { label: "ワークを始める", href: course.nextChapter ? `/work/${course.nextChapter.id}` : `/courses/${course.id}` };
          return (
            <li key={course.id} className="card overflow-hidden">
              <Link href={`/courses/${course.id}`} className="block p-5">
                <h2 className="text-lg font-bold leading-snug text-navy">{course.title}</h2>
                <p className="mt-3 text-sm text-ink">
                  進捗：{course.completed}章 / {course.total}章 完了
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar percent={course.percent} />
                  <span className="w-12 text-right text-sm font-bold text-navy">{course.percent}%</span>
                </div>
                {course.nextChapter && course.status === "in_progress" && (
                  <p className="mt-2 text-xs text-muted">次は 第{course.nextChapter.chapter_number}章：{course.nextChapter.title}</p>
                )}
              </Link>
              {course.total > 0 && (
                <div className="border-t border-line p-3">
                  <Link href={cta.href} className={`btn w-full ${course.status === "completed" ? "btn-outline" : "btn-primary"}`}>
                    {cta.label}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
