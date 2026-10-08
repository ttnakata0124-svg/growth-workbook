import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { APP_NAME, APP_NAME_JA } from "@/lib/config";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto",
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: `${APP_NAME_JA}：営業研修のワークにスマートフォンから取り組めるデジタルワークブック`,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME_JA, statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1b2a4a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={noto.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
