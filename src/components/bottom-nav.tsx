"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base = [
  { href: "/", label: "ホーム", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/history", label: "回答履歴", icon: "M12 8v4l3 2M21 12a9 9 0 11-9-9 9 9 0 019 9z" },
];
const admin = { href: "/admin", label: "管理", icon: "M4 6h16M4 12h16M4 18h10" };
const account = { href: "/account", label: "アカウント", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" };

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [...base, ...(isAdmin ? [admin] : []), account];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/courses") || pathname.startsWith("/work") : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-navy" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
                <span className={`h-0.5 w-6 rounded ${active ? "bg-gold" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
