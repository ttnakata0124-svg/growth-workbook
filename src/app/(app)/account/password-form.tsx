"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="label">新しいパスワード（8文字以上）</label>
        <input id="password" name="password" type="password" autoComplete="new-password" className="field" required minLength={8} />
      </div>
      <div>
        <label htmlFor="confirm" className="label">新しいパスワード（確認）</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="field" required minLength={8} />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">パスワードを変更しました。</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "変更中…" : "パスワードを変更"}</button>
    </form>
  );
}
