import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interactive Learning — by NEO",
  description: "Biến YouTube video thành bài học tương tác với Claude AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50">
        <nav className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">
              🎓 Interactive Learning
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/library" className="text-sm text-slate-600 hover:text-blue-600 transition-colors">
                Thư viện bài học
              </Link>
              <span className="text-xs text-slate-400">by <span className="font-semibold text-slate-600">NEO</span></span>
            </div>
          </div>
        </nav>
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white mt-auto">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">🎓 Interactive Learning Workflow</span>
            <span className="text-xs text-slate-400">
              Designed & built by <span className="font-semibold text-slate-600">NEO</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
