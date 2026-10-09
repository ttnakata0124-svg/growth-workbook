"use client";

import { useActionState, useEffect, useRef } from "react";
import { setLoginPin, type PinState } from "./actions";

export function PinSetupForm({ pinSet }: { pinSet: boolean }) {
  const [state, action, pending] = useActionState<PinState, FormData>(setLoginPin, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const pinProps = {
    type: "password",
    inputMode: "numeric",
    pattern: "\\d{6}",
    maxLength: 6,
    autoComplete: "off",
    required: true,
    className: "field tracking-[0.3em]",
  } as const;
  return (
    <form ref={ref} action={action} className="space-y-4">
      <div>
        <label htmlFor="pin" className="label">{pinSet ? "新しいログインコード（6桁の数字）" : "ログインコード（6桁の数字）"}</label>
        <input id="pin" name="pin" {...pinProps} />
      </div>
      <div>
        <label htmlFor="pin_confirm" className="label">ログインコード（確認）</label>
        <input id="pin_confirm" name="pin_confirm" {...pinProps} />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "設定中…" : pinSet ? "コードを変更" : "コードを設定"}</button>
    </form>
  );
}
