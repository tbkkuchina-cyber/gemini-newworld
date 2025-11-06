import type { Metadata } from "next";
// ★ 修正: Geist -> Inter に戻します
import { Inter } from "next/font/google";
import "./globals.css";
import { JotaiProvider } from "@/lib/store-provider";

// ★ 修正: Inter を初期化します
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ductwork Takeoff Tool",
  description: "A simple 2D ductwork design application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      {/* ★ 修正: className に inter.className を適用します */}
      <body className={`${inter.className} h-full`}>
        <JotaiProvider>{children}</JotaiProvider>
      </body>
    </html>
  );
}