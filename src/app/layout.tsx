import type { Metadata, Viewport } from "next";
import Link from "next/link";
import {
  DM_Sans,
  Fraunces,
  Geist_Mono,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK"],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Secondhand Scout",
  description:
    "Search eBay, Facebook Marketplace, and OfferUp from one honest interface.",
};

export const viewport: Viewport = {
  themeColor: "#1f5c4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable} ${spaceGrotesk.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <div className="relative mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <header className="mb-8 flex items-center justify-between gap-4">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                Secondhand Scout
              </span>
              <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                cross-market search
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/bookmarks"
                className="text-muted-foreground transition hover:text-foreground"
              >
                Bookmarks
              </Link>
              <a
                href="https://github.com/jakoggers/Envidex"
                className="text-muted-foreground transition hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
