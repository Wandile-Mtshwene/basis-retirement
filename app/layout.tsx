import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Retirement Outcome Illustrator",
  description: "Monte Carlo projection of retirement savings and drawdown.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-5 w-5 rounded bg-accent" />
              Retirement<span className="text-muted font-normal">Illustrator</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-foreground">Projection</Link>
              <a href="/api/docs" target="_blank" rel="noreferrer" className="hover:text-foreground">API docs ↗</a>
              <a href="https://github.com/Wandile-Mtshwene/basis-retirement" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub ↗</a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border text-muted text-xs">
          <div className="mx-auto max-w-6xl px-5 py-4 flex flex-wrap gap-x-6 gap-y-1 justify-between">
            <span>Open-core actuarial / quant engine · Python · FastAPI · Next.js</span>
            <span>Lognormal returns. Illustrative demo, not advice.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
