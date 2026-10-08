import type { Metadata } from "next";
import { APP_NAME, APP_NAME_JA } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 h-1 w-12 rounded bg-gold" />
        <h1 className="text-2xl font-bold tracking-wide text-navy">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted">{APP_NAME_JA}</p>
      </div>
      <LoginForm initialError={error === "inactive" ? "このアカウントは利用停止中です。管理者にお問い合わせください。" : undefined} />
      <p className="mt-8 text-center text-xs text-muted">
        アカウントは管理者が発行します。ログインできない場合は管理者にお問い合わせください。
      </p>
    </main>
  );
}
