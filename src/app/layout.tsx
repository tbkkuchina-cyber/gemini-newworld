import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { JotaiProvider } from "@/lib/store-provider";
import { ClientOnlyProvider } from "@/lib/ClientOnlyProvider";

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
      <body className={`${inter.className} h-full`}>
        <ClientOnlyProvider>
          <JotaiProvider>{children}</JotaiProvider>
        </ClientOnlyProvider>
      </body>
    </html>
  );
}
