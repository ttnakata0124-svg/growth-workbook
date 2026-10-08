import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ocrEnabled } from "@/lib/ocr";
import { QUESTION_TYPE_LABELS, type Chapter, type Course, type Question } from "@/lib/types";
import { MoveButtons, PublishBadge } from "@/components/move-buttons";
import { archiveChapter, archiveQuestion, moveQuestion, updateChapter } from "../../courses/actions";
import { EditQuestionToggle, QuestionEditor } from "./question-editor";
import { ImagePanel } from "./image-panel";

export default async function AdminChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const supabase = await createClient();
  const [{ data: chapter }, { data: questions }, { data: images }] = await Promise.all([
    supabase.from("chapters").select("*, course:courses(*)").eq("id", chapterId).maybeSingle(),
    supabase.from("questions").select("*").eq("chapter_id", chapterId).order("sort_order"),
    supabase.from("chapter_images").select("id, storage_path").eq("chapter_id", chapterId).order("created_at"),
  ]);
  if (!chapter) notFound();
  const ch = chapter as Chapter & { course: Course };
  const all = (questions ?? []) as Question[];
  const active = all.filter((q) => !q.archived_at);
  const archived = all.filter((q) => q.archived_at);

  // 非公開バケットの画像は短時間だけ有効な署名付きURLで表示
  const paths = (images ?? []).map((i) => i.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("course-images").createSignedUrls(paths, 60 * 30)
    : { data: [] };
  const imgs = (images ?? []).map((i, idx) => ({ id: i.id, url: signed?.[idx]?.signedUrl ?? null }));

  let regular = 0;
  return (
    <main className="space-y-6">
      <Link href={`/admin/courses/${ch.course_id}`} className="text-sm text-muted">← {ch.course.title}</Link>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-navy">章の設定</h1>
          <PublishBadge published={ch.is_published} />
        </div>
        <form action={updateChapter} className="space-y-3">
          <input type="hidden" name="id" value={ch.id} />
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <div>
              <label className="label" htmlFor="chapter_number">章番号</label>
              <input id="chapter_number" name="chapter_number" type="number" min={1} defaultValue={ch.chapter_number} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="title">章タイトル</label>
              <input id="title" name="title" defaultValue={ch.title} className="field" required />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="is_published" defaultChecked={ch.is_published} className="h-5 w-5 accent-[#1b2a4a]" />
            社員に公開する
          </label>
          <button className="btn btn-primary w-full sm:w-auto">保存</button>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-bold text-navy">教材写真</h2>
        <p className="mb-3 text-xs text-muted">写真をアップロードし、設問を読み取る（または写真を見ながら手入力する）ことができます。</p>
        <ImagePanel chapterId={ch.id} images={imgs} ocr={ocrEnabled()} />
      </section>

      <section>
        <h2 className="font-bold text-navy">設問（{active.length}問）</h2>
        <ol className="mt-3 space-y-2">
          {active.map((q, i) => (
            <li key={q.id} className="card p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gold">
                    {q.question_type === "commitment" ? "実行への決意" : `Q${++regular}`}・{QUESTION_TYPE_LABELS[q.question_type]}
                  </p>
                  <p className="text-sm leading-relaxed">{q.prompt}</p>
                </div>
                <MoveButtons id={q.id} action={moveQuestion} first={i === 0} last={i === active.length - 1} />
              </div>
              <div className="mt-2 flex gap-2">
                <EditQuestionToggle
                  chapterId={ch.id}
                  question={{ id: q.id, question_type: q.question_type, prompt: q.prompt, description: q.description, config: q.config }}
                />
                <form action={archiveQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <button className="btn btn-danger btn-sm">削除（アーカイブ）</button>
                </form>
              </div>
            </li>
          ))}
        </ol>
        {archived.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">アーカイブ済みの設問（{archived.length}）</summary>
            <ul className="mt-2 space-y-2">
              {archived.map((q) => (
                <li key={q.id} className="card flex items-center gap-3 p-3 opacity-70">
                  <p className="flex-1 text-sm">{q.prompt}</p>
                  <form action={archiveQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="restore" value="1" />
                    <button className="btn btn-outline btn-sm">元に戻す</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-navy">設問を追加</h2>
        <QuestionEditor chapterId={ch.id} submitLabel="設問を追加" />
      </section>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm text-muted">章をアーカイブ（一覧から外す）</summary>
        <p className="mt-2 text-xs text-muted">社員の回答履歴は残ります。進捗率の分母からも外れます。</p>
        <form action={archiveChapter} className="mt-3">
          <input type="hidden" name="id" value={ch.id} />
          <button className="btn btn-danger btn-sm">この章をアーカイブ</button>
        </form>
      </details>
    </main>
  );
}
