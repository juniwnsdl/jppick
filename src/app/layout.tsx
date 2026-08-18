import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppNav } from "../components/app-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "가나 학습",
  description: "히라가나와 가타카나를 익히는 학습 도구",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <header className="app-shell-header">
            <Link className="app-brand" href="/">
              가나 학습
            </Link>
            <AppNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
