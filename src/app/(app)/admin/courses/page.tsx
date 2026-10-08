import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";
import { MoveButtons, PublishBadge } from "@/components/move-buttons";
import { createCourse, moveCourse } from "./actions";

export const metadata = { title: "教材管理" };

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const [{ data: courses }, { data: chapters }] = await Promise.all([
    supabase.from("courses").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("chapters").select("id, course_id, is_published").is("archived_at", null),
  ]);
  const list = (courses ?? []) as Course[];
  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-lg font-bold text-navy">教材一覧</h1>
        <ul className="mt-3 space-y-2">
          {list.map((c, i) => {
            const chs = (chapters ?? []).filter((x) => x.course_id === c.id);
            return (
              <li key={c.id} className="card flex items-center gap-3 p-3">
                <Link href={`/admin/courses/${c.id}`} className="min-w-0 flex-1">
                  <p className="font-bold leading-snug text-navy">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    章 {chs.length}（公開 {chs.filter((x) => x.is_published).length}）
                  </p>
                </Link>
                <PublishBadge published={c.is_published} />
                <MoveButtons id={c.id} action={moveCourse} first={i === 0} last={i === list.length - 1} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-navy">教材を追加</h2>
        <form action={createCourse} className="space-y-3">
          <div>
            <label className="label" htmlFor="title">教材名</label>
            <input id="title" name="title" className="field" required placeholder="例：プロフェッショナルセールスマネージャー" />
          </div>
          <div>
            <label className="label" htmlFor="description">説明（任意）</label>
            <textarea id="description" name="description" className="field" rows={2} />
          </div>
          <p className="text-xs text-muted">作成直後は「非公開」です。章と設問を登録してから公開してください。</p>
          <button className="btn btn-primary w-full sm:w-auto">教材を追加</button>
        </form>
      </section>
    </main>
  );
}
