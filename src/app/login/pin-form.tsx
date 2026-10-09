"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pinLogin, type LoginState } from "./actions";

export function PinForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(pinLogin, {});
  return (
    <form action={action} className="space-y-5">
      <p className="text-center font-bold text-navy">{fullName ? `${fullName} さん` : "おかえりなさい"}</p>
      <div>
        <label htmlFor="pin" className="label">6桁のログインコード</label>
        <input
          id="pin"
          name="pin"
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
        <Link href="/login?mode=password" className="text-navy underline">メールアドレスとパスワードでログイン</Link>
      </p>
    </form>
  );
}
