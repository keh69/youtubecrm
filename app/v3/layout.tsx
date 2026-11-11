import './theme.css'
import './theme-light.css'
import { SiteVersion } from '@/components/site-version'

// v3 · Paper Journal — 크림색 종이, 잉크 글씨, 테라코타 포인트. 신문 1면처럼 한 줄 기둥에 이중 괘선으로 구획.
export default function V3Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;600;700;900&display=swap"
        precedence="default"
      />
      <div className="v3">
        {children}
        <SiteVersion />
      </div>
    </>
  )
}
