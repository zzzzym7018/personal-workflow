import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "知行台", template: "%s — 知行台" },
  description: "把日程、项目、领域学习和新想法连接起来的私人工作台。",
  openGraph: {
    title: "知行台",
    description: "把日程、项目、领域学习和新想法连接起来的私人工作台。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og-zhixing-desk.png", width: 1200, height: 630, alt: "日光研究工作台与知识观测轨道" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "知行台",
    description: "私人日程、项目与领域学习工作台",
    images: ["/og-zhixing-desk.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
