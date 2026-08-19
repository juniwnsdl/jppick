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
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link crossOrigin="anonymous" href="https://cdn.jsdelivr.net" rel="preconnect" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-shell">
          <header className="app-shell-header">
            <div className="app-shell-header-inner">
              <Link className="app-brand" href="/">
                <span aria-hidden="true" className="app-brand-mark">あ</span>
                <span className="app-brand-text">가나 학습</span>
              </Link>
              <AppNav />
            </div>
          </header>
          {children}
          <footer className="app-footer">학습 기록은 이 브라우저에만 저장돼요.</footer>
        </div>
      </body>
    </html>
  );
}
