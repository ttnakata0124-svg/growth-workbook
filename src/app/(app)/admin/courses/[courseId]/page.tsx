import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Chapter, Course } from "@/lib/types";
import { MoveButtons, PublishBadge } from "@/components/move-buttons";
import { archiveCourse, createChapter, moveChapter, updateCourse } from "../actions";

export default async function AdminCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const [{ data: course }, { data: chapters }, { data: questions }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    supabase.from("chapters").select("*").eq("course_id", courseId).is("archived_at", null).order("sort_order"),
    supabase.from("questions").select("id, chapter_id").is("archived_at", null),
  ]);
  if (!course) notFound();
  const c = course as Course;
  const list = (chapters ?? []) as Chapter[];
  const nextNumber = Math.max(0, ...list.map((x) => x.chapter_number)) + 1;

  return (
    <main className="space-y-6">
      <Link href="/admin/courses" className="text-sm text-muted">← 教材一覧</Link>

      <section className="card p-4">
        <h1 className="mb-3 text-lg font-bold text-navy">教材の設定</h1>
        <form action={updateCourse} className="space-y-3">
          <input type="hidden" name="id" value={c.id} />
          <div>
            <label className="label" htmlFor="title">教材名</label>
            <input id="title" name="title" defaultValue={c.title} className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="description">説明</label>
            <textarea id="description" name="description" defaultValue={c.description} className="field" rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="is_published" defaultChecked={c.is_published} className="h-5 w-5 accent-[#1b2a4a]" />
            社員に公開する
          </label>
          <button className="btn btn-primary w-full sm:w-auto">保存</button>
        </form>
      </section>

      <section>
        <h2 className="font-bold text-navy">章（{list.length}）</h2>
        <p className="text-xs text-muted">進捗率は「公開中の章」の数で計算されます。</p>
        <ul className="mt-3 space-y-2">
          {list.map((ch, i) => (
            <li key={ch.id} className="card flex items-center gap-3 p-3">
              <Link href={`/admin/chapters/${ch.id}`} className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gold">第{ch.chapter_number}章</p>
                <p className="font-bold leading-snug text-navy">{ch.title}</p>
                <p className="text-xs text-muted">設問 {(questions ?? []).filter((q) => q.chapter_id === ch.id).length}問</p>
              </Link>
              <PublishBadge published={ch.is_published} />
              <MoveButtons id={ch.id} action={moveChapter} first={i === 0} last={i === list.length - 1} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-navy">章を追加</h2>
        <form action={createChapter} className="space-y-3">
          <input type="hidden" name="course_id" value={c.id} />
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <div>
              <label className="label" htmlFor="chapter_number">章番号</label>
              <input id="chapter_number" name="chapter_number" type="number" min={1} defaultValue={nextNumber} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="ch_title">章タイトル</label>
              <input id="ch_title" name="title" className="field" required placeholder="例：目標設定" />
            </div>
          </div>
          <p className="text-xs text-muted">追加後、写真のアップロードまたは設問の入力に進みます（作成直後は非公開）。</p>
          <button className="btn btn-primary w-full sm:w-auto">章を追加</button>
        </form>
      </section>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm text-muted">教材をアーカイブ（一覧から外す）</summary>
        <p className="mt-2 text-xs text-muted">社員の回答履歴は残ります。</p>
        <form action={archiveCourse} className="mt-3">
          <input type="hidden" name="id" value={c.id} />
          <button className="btn btn-danger btn-sm">この教材をアーカイブ</button>
        </form>
      </details>
    </main>
  );
}
