"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChapterImage, extractFromImage, uploadChapterImage, type QuestionInput } from "../../courses/actions";
import { ExtractedReview } from "./question-editor";

type Img = { id: string; url: string | null };

export function ImagePanel({ chapterId, images, ocr }: { chapterId: string; images: Img[]; ocr: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [extracting, setExtracting] = useState<string | null>(null);
  const [review, setReview] = useState<QuestionInput[] | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <div>
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await uploadChapterImage(fd);
            setError(r.error ?? null);
            if (!r.error) formRef.current?.reset();
            router.refresh();
          })
        }
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="chapter_id" value={chapterId} />
        <input name="files" type="file" accept="image/*" multiple className="text-sm" aria-label="教材写真" />
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "アップロード中…" : "アップロード"}</button>
      </form>
      <p className="mt-1 text-xs text-muted">写真は非公開で保存され、ログインした社内利用者だけが閲覧できます。</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="rounded-xl border border-line p-2">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="教材写真" className="aspect-[3/4] w-full cursor-zoom-in rounded-lg object-cover" onClick={() => setZoom(img.url)} />
              ) : (
                <div className="aspect-[3/4] rounded-lg bg-soft" />
              )}
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  disabled={!!extracting}
                  title={ocr ? "" : "ANTHROPIC_API_KEY を設定すると使えます"}
                  onClick={async () => {
                    setExtracting(img.id);
                    setError(null);
                    const r = await extractFromImage(img.id);
                    setExtracting(null);
                    if (r.error) setError(r.error);
                    else setReview(r.questions ?? []);
                  }}
                >
                  {extracting === img.id ? "読み取り中…" : "設問を読み取る"}
                </button>
                <form action={deleteChapterImage}>
                  <input type="hidden" name="id" value={img.id} />
                  <button className="btn btn-outline btn-sm w-full">削除</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!ocr && images.length > 0 && (
        <p className="mt-2 text-xs text-muted">自動読み取りは未設定です。写真をタップして拡大し、下の「設問を追加」から手入力してください。</p>
      )}

      {zoom && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="教材写真（拡大）" className="max-h-full max-w-full rounded" />
        </div>
      )}
      {review && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto max-w-xl rounded-2xl bg-white p-5">
            <h3 className="mb-3 font-bold text-navy">読み取った設問の確認</h3>
            {review.length === 0 ? (
              <p className="text-sm">設問が見つかりませんでした。手入力で登録してください。</p>
            ) : (
              <ExtractedReview chapterId={chapterId} initial={review} onClose={() => setReview(null)} />
            )}
            {review.length === 0 && <button className="btn btn-outline mt-3" onClick={() => setReview(null)}>閉じる</button>}
          </div>
        </div>
      )}
    </div>
  );
}
