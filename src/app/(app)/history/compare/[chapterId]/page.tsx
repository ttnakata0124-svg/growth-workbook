import Link from "next/link";
import { notFound } from "next/navigation";
import { chapterLabel, formatDate, getMyAttempts } from "@/lib/data";
import { getAttemptDetail } from "@/lib/history";
import { AnswerView } from "@/components/answer/answer-view";

export const metadata = { title: "回答の比較" };

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ chapterId: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const [{ chapterId }, sp] = await Promise.all([params, searchParams]);
  const completed = (await getMyAttempts(chapterId)).filter((a) => a.status === "completed");
  if (completed.length < 2) notFound();

  const pick = (id: string | undefined, fallback: string) => (completed.some((a) => a.id === id) ? id! : fallback);
  const aId = pick(sp.a, completed[0].id);
  const bId = pick(sp.b, completed[completed.length - 1].id);
  const [left, right] = await Promise.all([getAttemptDetail(aId), getAttemptDetail(bId)]);
  if (!left || !right) notFound();

  const order = new Map<string, number>();
  [...left.items, ...right.items].forEach((i) => order.set(i.questionId, Math.min(order.get(i.questionId) ?? Infinity, i.sortOrder)));
  const ids = [...order.keys()].sort((x, y) => order.get(x)! - order.get(y)!);
  const leftMap = new Map(left.items.map((i) => [i.questionId, i]));
  const rightMap = new Map(right.items.map((i) => [i.questionId, i]));
  const name = (a: typeof completed[number]) => `${a.attempt_number}回目（${formatDate(a.completed_at)}）`;

  return (
    <main>
      <Link href="/history" className="text-sm text-muted">← 回答履歴</Link>
      <h1 className="mt-2 text-xl font-bold leading-snug text-navy">{chapterLabel(left.chapter)}</h1>
      <p className="text-sm text-muted">過去の回答と最新の回答を並べて表示します。</p>

      <form className="card mt-4 grid grid-cols-2 gap-3 p-3" method="get">
        <label className="text-xs font-bold text-muted">
          以前
          <select name="a" defaultValue={aId} className="field mt-1 py-2 text-sm">
            {completed.map((a) => <option key={a.id} value={a.id}>{name(a)}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-muted">
          比較対象
          <select name="b" defaultValue={bId} className="field mt-1 py-2 text-sm">
            {completed.map((a) => <option key={a.id} value={a.id}>{name(a)}</option>)}
          </select>
        </label>
        <button className="btn btn-outline btn-sm col-span-2" type="submit">表示する</button>
      </form>

      <ol className="mt-5 space-y-4">
        {ids.map((id) => {
          const l = leftMap.get(id);
          const r = rightMap.get(id);
          const base = r ?? l!;
          return (
            <li key={id} className="card p-4">
              <h2 className="font-bold leading-relaxed">{base.type === "commitment" ? "【実行への決意】" : ""}{base.prompt}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-soft p-3">
                  <p className="mb-1 text-xs font-bold text-muted">以前：{name(left.attempt)}</p>
                  {l ? <AnswerView type={l.type} config={l.config} content={l.content} /> : <p className="text-sm text-gray-400">（この設問はありませんでした）</p>}
                </div>
                <div className="rounded-xl border border-gold/40 bg-gold-soft/40 p-3">
                  <p className="mb-1 text-xs font-bold text-[#8a6a22]">比較対象：{name(right.attempt)}</p>
                  {r ? <AnswerView type={r.type} config={r.config} content={r.content} /> : <p className="text-sm text-gray-400">（この設問はありませんでした）</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
