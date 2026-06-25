import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '고통의 이름 — 팔고(八苦)로 마음의 고통을 진단합니다',
  description: '팔고(八苦) 이론으로 지금 내 고통에 이름을 붙이세요. 2500년 된 분류 체계로 마음의 고통을 진단합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
