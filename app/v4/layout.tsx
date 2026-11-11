import './theme.css'
import './theme-light.css'
import { SiteVersion } from '@/components/site-version'

// v4 · Bold Block — 네오 브루탈리즘. 크림색 바탕 위에 노랑·분홍·파랑·민트 블록, 검은 3px 테두리와 딱딱한 그림자.
export default function V4Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&display=swap"
        precedence="default"
      />
      <div className="v4">
        {children}
        <SiteVersion />
      </div>
    </>
  )
}
