import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "烛龙 ZHULONG · 负荷预测决策台",
  description:
    "电力负荷预测决策台——14 年 · 3 个负荷区 · 358,800 个小时；预测与真实对质，每一次预测都接受覆盖率审计。",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'%3E%3Cpath d='M2.5 13 C6 7.5 20 7.5 23.5 13 C20 18.5 6 18.5 2.5 13 Z' fill='none' stroke='%230E7490' stroke-width='1.6'/%3E%3Ccircle cx='13' cy='13' r='3.4' fill='none' stroke='%230E7490' stroke-width='1.6'/%3E%3Ccircle cx='13' cy='13' r='1.2' fill='%230E7490'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/* 启动前应用持久化主题（写在渲染之前，避免首帧闪色）——与原型 IIFE 等价；
   默认深色（用户裁决 8/29）：无记录用 dark，用户手动切换过则尊重其选择 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem('zl-theme');if(t!=='light'&&t!=='dark')t='dark';if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* 快照预取：HTML 解析期即开始下载，boot 时秒读（秒开架构） */}
        <link rel="preload" as="script" href="/data/zhulong-data.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
