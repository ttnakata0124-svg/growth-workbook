"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "学習進捗", match: (p: string) => p === "/admin" },
  { href: "/admin/users", label: "社員", match: (p: string) => p.startsWith("/admin/users") },
  { href: "/admin/courses", label: "教材", match: (p: string) => p.startsWith("/admin/courses") || p.startsWith("/admin/chapters") },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="flex rounded-xl bg-soft p-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-bold ${t.match(pathname) ? "bg-white text-navy shadow-sm" : "text-muted"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
