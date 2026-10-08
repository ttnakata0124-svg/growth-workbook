import Link from "next/link";
import { chapterLabel, formatDate } from "@/lib/data";
import { getMyHistory } from "@/lib/history";

export const metadata = { title: "回答履歴" };

export default async function HistoryPage() {
  const attempts = await getMyHistory();

  // 教材 → 章 ごとにまとめる
  const groups = new Map<string, { course: string; chapterId: string; chapter: string; sort: number; items: typeof attempts }>();
  for (const a of attempts) {
    const key = a.chapter_id;
    if (!groups.has(key))
      groups.set(key, {
        course: a.chapter.course.title,
        chapterId: a.chapter_id,
        chapter: chapterLabel(a.chapter),
        sort: a.chapter.course.sort_order * 10000 + a.chapter.sort_order,
        items: [],
      });
    groups.get(key)!.items.push(a);
  }
  const list = [...groups.values()].sort((x, y) => x.sort - y.sort);

  return (
    <main>
      <h1 className="text-xl font-bold text-navy">回答履歴</h1>
      <p className="mt-1 text-sm text-muted">あなたの回答は本人だけが見られます。管理者も回答内容は見られません。</p>

      {list.length === 0 && <p className="card mt-6 p-6 text-center text-muted">まだ回答履歴はありません。</p>}

      <ul className="mt-5 space-y-4">
        {list.map((g) => {
          const completed = g.items.filter((a) => a.status === "completed");
          return (
            <li key={g.chapterId} className="card p-4">
              <p className="text-xs text-muted">{g.course}</p>
              <h2 className="font-bold leading-snug text-navy">{g.chapter}</h2>
              <ul className="mt-3 divide-y divide-line">
                {g.items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/history/${a.id}`} className="flex items-center justify-between py-2.5 text-sm">
                      <span>
                        {a.attempt_number}回目・{formatDate(a.completed_at ?? a.started_at)}
                      </span>
                      <span className={a.status === "completed" ? "text-navy" : "text-[#8a6a22]"}>
                        {a.status === "completed" ? "完了" : "途中"} ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {completed.length >= 2 && (
                <Link href={`/history/compare/${g.chapterId}`} className="btn btn-outline btn-sm mt-2 w-full">
                  過去の回答と最新の回答を比較する
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
