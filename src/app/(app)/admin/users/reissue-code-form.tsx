"use client";

import { useActionState } from "react";
import { reissueCode, type FormState } from "./actions";
import { CodeResult } from "./code-result";

export function ReissueCodeForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reissueCode, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="user_id" value={userId} />
      <button className="btn btn-outline btn-sm" disabled={pending}>{pending ? "発行中…" : "ログインコードを再発行"}</button>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <CodeResult ok={state.ok} code={state.code} />
    </form>
  );
}
