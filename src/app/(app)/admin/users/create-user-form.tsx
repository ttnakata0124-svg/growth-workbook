"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUser, type FormState } from "./actions";
import { CodeResult } from "./code-result";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="full_name">氏名</label>
          <input id="full_name" name="full_name" className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="new_email">メールアドレス（社員は空欄でOK）</label>
          <input id="new_email" name="email" type="email" className="field" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="new_password">初期パスワード（メールアドレスを入れた場合のみ・8文字以上）</label>
          <input id="new_password" name="password" type="text" className="field" minLength={8} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="role">権限</label>
          <select id="role" name="role" className="field" defaultValue="employee">
            <option value="employee">一般社員</option>
            <option value="admin">管理者</option>
          </select>
        </div>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <CodeResult ok={state.ok} code={state.code} />
      <p className="text-xs text-muted">一般社員には6桁のログインコードが発行され、コードを入れるだけでログインできます。管理者はメールアドレスとパスワードでログインします。</p>
      <button className="btn btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "作成中…" : "アカウントを作成"}</button>
    </form>
  );
}
