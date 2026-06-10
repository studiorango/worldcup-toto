import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '⚽ 2026 월드컵 토토',
  description: '친구들과 함께하는 2026 북중미 월드컵 승부 예측',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css" />
      </head>
      <body style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
