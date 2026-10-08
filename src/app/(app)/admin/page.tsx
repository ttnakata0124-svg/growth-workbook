import Link from "next/link";
import { getAdminProgress } from "@/lib/admin-data";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "学習進捗" };

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }) : "—";

export default async function AdminProgressPage() {
  const rows = (await getAdminProgress()).filter((r) => r.is_active);
  return (
    <main>
      <h1 className="text-xl font-bold text-navy">学習進捗</h1>
      <p className="mt-1 text-xs text-muted">表示されるのは進捗状況のみです。社員の回答内容は管理者にも表示されません。</p>

      {rows.length === 0 && <p className="card mt-5 p-6 text-center text-muted">表示できるデータがありません。</p>}

      {/* スマホ: カード / PC: 表 */}
      <ul className="mt-4 space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={`${r.user_id}-${r.course_id}`}>
            <Link href={`/admin/users/${r.user_id}`} className="card block p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-navy">{r.full_name || r.email}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 truncate text-xs text-muted">{r.course_title}</p>
              <p className="mt-1 text-sm">
                {r.completed_chapters}/{r.total_chapters}章・<strong>{r.progress_percent}%</strong>
                <span className="ml-2 text-xs text-muted">最終実施 {shortDate(r.last_activity_at)}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="card mt-4 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-soft text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">社員</th>
              <th className="px-3 py-2">教材</th>
              <th className="px-3 py-2">完了章</th>
              <th className="px-3 py-2">進捗</th>
              <th className="px-3 py-2">状況</th>
              <th className="px-3 py-2">最終実施</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={`${r.user_id}-${r.course_id}`}>
                <td className="px-3 py-2">
                  <Link href={`/admin/users/${r.user_id}`} className="font-bold text-navy underline-offset-2 hover:underline">
                    {r.full_name || r.email}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.course_title}</td>
                <td className="px-3 py-2">{r.completed_chapters} / {r.total_chapters}</td>
                <td className="px-3 py-2 font-bold">{r.progress_percent}%</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2">{shortDate(r.last_activity_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
