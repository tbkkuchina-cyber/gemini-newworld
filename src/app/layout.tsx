import type { Metadata } from "next";
// ★ Inter フォントをインポート
import { Inter } from "next/font/google";
import "./globals.css";
// ★ JotaiProvider をインポート
import { JotaiProvider } from "@/lib/store-provider";

// ★ Inter を初期化
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // ★ タイトルを Next.js版 に合わせます
  title: "Ductwork Takeoff Tool",
  description: "A simple 2D ductwork design application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ★ h-full を追加
    <html lang="ja" className="h-full">
      {/* ★ className と JotaiProvider を適用 */}
      <body className={`${inter.className} h-full`}>
        <JotaiProvider>{children}</JotaiProvider>
      </body>
    </html>
  );
}