"use client";

import Link from "next/link";
import { useActionState } from "react";
import { codeLogin, type LoginState } from "./actions";

export function CodeForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(codeLogin, {});
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="code" className="label">6桁のログインコード</label>
        <input
          id="code"
          name="code"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="current-password"
          autoFocus
          required
          className="field text-center text-2xl tracking-[0.5em]"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "ログイン中…" : "ログイン"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login?mode=password" className="text-navy underline">メールアドレスでログイン（管理者）</Link>
      </p>
    </form>
  );
}
