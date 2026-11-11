import './globals.css'
import type { Metadata, Viewport } from 'next'
import { BUILD_VERSION } from '@/lib/generated-version'
import { VersionSwitcher } from '@/components/version-switcher'
import { ImpersonationBar } from '@/components/impersonation-bar'

// 루트 레이아웃은 비워 둔다. 화면 모양(헤더, 메뉴, 색, 글꼴)은 v1~v5 각 버전 레이아웃이 전부 정한다.
export const metadata: Metadata = {
  title: '여왕개미미디어 CRM',
  description: '근태 · 영상등록 · 통계',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png'
  }
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ImpersonationBar />
        <VersionSwitcher buildVersion={BUILD_VERSION} />
      </body>
    </html>
  )
}
