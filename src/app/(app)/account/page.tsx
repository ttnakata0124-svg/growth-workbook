import { getCurrentProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { hasPin } from "@/lib/pin";
import { isPlaceholderEmail } from "@/lib/login-code";
import { MyCodeForm } from "./my-code-form";
import { removeLoginPin } from "./actions";
import { PasswordForm } from "./password-form";
import { PinSetupForm } from "./pin-setup-form";

export const metadata = { title: "アカウント" };

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile.role === "admin";
  const pinSet = isAdmin && (await hasPin(profile.id));
  const codeOnly = isPlaceholderEmail(profile.email);
  return (
    <main className="space-y-6">
      <h1 className="text-xl font-bold text-navy">アカウント</h1>
      <section className="card space-y-1 p-4 text-sm">
        <p><span className="text-muted">氏名：</span>{profile.full_name || "—"}</p>
        {!codeOnly && <p><span className="text-muted">メール：</span>{profile.email}</p>}
        <p><span className="text-muted">権限：</span>{profile.role === "admin" ? "管理者" : "社員"}</p>
      </section>
      {!isAdmin && (
        <section className="card p-4">
          <h2 className="font-bold text-navy">ログインコード</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            ログイン画面で6桁のログインコードを入れると、どの端末からでもログインできます。コードを忘れたときや、人に知られたかもしれないときは、新しいコードを発行してください（以前のコードは使えなくなります）。
          </p>
          <MyCodeForm />
        </section>
      )}
      {isAdmin && (
      <section className="card p-4">
        <h2 className="font-bold text-navy">6桁のログインコード</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          設定すると、この端末では次回から6桁のコードだけでログインできます。別の端末では、最初の1回だけメールアドレスとパスワードでログインしてください。
          {pinSet && "（設定済み）"}
        </p>
        <PinSetupForm pinSet={pinSet} />
        {pinSet && (
          <form action={removeLoginPin} className="mt-3">
            <button className="btn btn-outline w-full">ログインコードを解除</button>
          </form>
        )}
      </section>
      )}
      {!codeOnly && (
        <section className="card p-4">
          <h2 className="mb-3 font-bold text-navy">パスワード変更</h2>
          <PasswordForm />
        </section>
      )}
      <section className="card p-4">
        <h2 className="font-bold text-navy">ホーム画面に追加</h2>
        <p className="mt-1 text-sm text-muted">
          iPhone：Safari の共有ボタン →「ホーム画面に追加」。Android：Chrome のメニュー →「ホーム画面に追加」または「アプリをインストール」。
        </p>
      </section>
      <form action={logout}>
        <button className="btn btn-outline w-full">ログアウト</button>
      </form>
    </main>
  );
}
