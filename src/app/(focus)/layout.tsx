import { getCurrentProfile } from "@/lib/auth";

// ワーク回答画面用：下部ナビを出さず、入力に集中できるレイアウト
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await getCurrentProfile();
  return <div className="min-h-dvh">{children}</div>;
}
