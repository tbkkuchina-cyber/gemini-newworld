import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Interフォントをインポート
import Script from "next/script"; // next/scriptをインポート
import "./globals.css";
import FittingsModal from '@/components/FittingsModal';
import ErrorModal from '@/components/ErrorModal'; // ★ エラーモーダルをインポート
import ConfirmModal from '@/components/ConfirmModal'; // ★ 確認モーダルをインポート

const inter = Inter({ subsets: ["latin"] }); // Interフォントを設定

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
        className={`${inter.className} antialiased`} // Interフォントを適用
      >
        {children}
        <FittingsModal />
        <ErrorModal /> {/* ★ エラーモーダルコンポーネントをここに追加 */}
        <ConfirmModal />
        <Script
          id="sw-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration.scope);
                  }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
