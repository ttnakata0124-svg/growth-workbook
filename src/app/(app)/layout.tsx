import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const isAdmin = profile.role === "admin";
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-bold tracking-wider text-navy">
            {APP_NAME}
          </Link>
          <span className="max-w-[45%] truncate text-xs text-muted">{profile.full_name || profile.email} さん</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-5">{children}</div>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
