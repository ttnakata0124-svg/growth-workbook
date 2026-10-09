"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: initialError });
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="label">メールアドレス</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">パスワード</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "ログイン中…" : "ログイン"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login?mode=code" className="text-navy underline">ログインコードでログイン</Link>
      </p>
    </form>
  );
}
