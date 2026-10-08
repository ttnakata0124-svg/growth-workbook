import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/data";
import type { Profile } from "@/lib/types";
import { updateUser } from "./actions";
import { CreateUserForm } from "./create-user-form";

export const metadata = { title: "社員アカウント" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at");
  const users = (data ?? []) as Profile[];

  return (
    <main className="space-y-6">
      <section className="card p-4">
        <h1 className="mb-3 text-lg font-bold text-navy">社員アカウントを追加</h1>
        <CreateUserForm />
      </section>

      <section>
        <h2 className="mb-2 font-bold text-navy">登録済みアカウント（{users.length}名）</h2>
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id} className={`card p-4 ${u.is_active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/admin/users/${u.id}`} className="font-bold text-navy underline-offset-2 hover:underline">
                    {u.full_name || "（氏名未設定）"}
                  </Link>
                  <p className="text-xs text-muted">{u.email}・登録 {formatDate(u.created_at)}</p>
                </div>
                <div className="flex gap-1.5 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${u.role === "admin" ? "bg-navy text-white" : "bg-gray-100 text-gray-700"}`}>
                    {u.role === "admin" ? "管理者" : "社員"}
                  </span>
                  {!u.is_active && <span className="rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-700">停止中</span>}
                </div>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-muted">編集</summary>
                <div className="mt-3 space-y-3">
                  <form action={updateUser} className="flex gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="op" value="rename" />
                    <input name="full_name" defaultValue={u.full_name} className="field py-2" aria-label="氏名" />
                    <button className="btn btn-outline btn-sm">氏名を保存</button>
                  </form>
                  <form action={updateUser} className="flex gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="op" value="password" />
                    <input name="password" type="text" minLength={8} placeholder="新しいパスワード（8文字以上）" className="field py-2" aria-label="新しいパスワード" autoComplete="off" />
                    <button className="btn btn-outline btn-sm">再設定</button>
                  </form>
                  {u.id !== me.id && (
                    <div className="flex flex-wrap gap-2">
                      <form action={updateUser}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="op" value="role" />
                        <input type="hidden" name="role" value={u.role === "admin" ? "employee" : "admin"} />
                        <button className="btn btn-outline btn-sm">{u.role === "admin" ? "一般社員にする" : "管理者にする"}</button>
                      </form>
                      <form action={updateUser}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="op" value={u.is_active ? "deactivate" : "activate"} />
                        <button className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-outline"}`}>
                          {u.is_active ? "利用停止" : "利用再開"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
