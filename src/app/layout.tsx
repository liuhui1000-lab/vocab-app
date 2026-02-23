import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: '中考词汇通 - 智能背单词',
  description: '多学期词汇管理，智能记忆曲线复习，随时随地背诵单词',
  keywords: ['背单词', '中考英语', '词汇', '记忆曲线', '艾宾浩斯'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}
