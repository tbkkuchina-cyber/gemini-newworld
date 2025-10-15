import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FittingsModal from '@/components/FittingsModal';
import ErrorModal from '@/components/ErrorModal'; // ★ エラーモーダルをインポート
import PwaRegistry from "@/components/PwaRegistry"; // PWA登録コンポーネントをインポート

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "簡易ダクト設計アプリ",
  description: "A simple duct design application",
  manifest: "/manifest.json", // manifest.jsonへのリンクはここに残します
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <FittingsModal />
        <ErrorModal /> {/* ★ エラーモーダルコンポーネントをここに追加 */}
        <PwaRegistry /> {/* PWA登録コンポーネントを呼び出し */}
      </body>
    </html>
  );
}
