import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { LabelsProvider } from "@/hooks/useLabels";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UnireLite - 北大情報ポータル",
  description: "北海道大学 Gmail × Unire 統合 PWA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UnireLite",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#006934",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <FavoritesProvider>
            <LabelsProvider>{children}</LabelsProvider>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
