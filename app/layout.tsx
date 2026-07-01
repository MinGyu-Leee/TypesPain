import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '마음결 — 당신이 힘든 이유에는 이름이 있어요',
  description: '지금 내 감정에 이름을 붙이세요. 2500년 된 심리 분류 체계로 마음의 상태를 진단합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
