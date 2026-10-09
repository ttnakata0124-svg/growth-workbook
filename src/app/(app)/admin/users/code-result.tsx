// 発行したログインコードを大きく表示する（この1回だけ）
export function CodeResult({ ok, code }: { ok?: string; code?: string }) {
  if (!ok) return null;
  return (
    <div role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
      <p>{ok}</p>
      {code && <p className="mt-1 text-center text-3xl font-bold tracking-[0.3em] text-navy" data-testid="login-code">{code}</p>}
    </div>
  );
}
