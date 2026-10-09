"use client";

import { useActionState } from "react";
import { reissueMyCode, type MyCodeState } from "./actions";

export function MyCodeForm() {
  const [state, action, pending] = useActionState<MyCodeState, FormData>(reissueMyCode, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.code && (
        <div role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          <p>新しいログインコードです。忘れないように控えてください（この画面を閉じると再表示できません）。</p>
          <p className="mt-1 text-center text-3xl font-bold tracking-[0.3em] text-navy" data-testid="login-code">{state.code}</p>
        </div>
      )}
      <button className="btn btn-outline w-full" disabled={pending}>{pending ? "発行中…" : "新しいコードを発行"}</button>
    </form>
  );
}
