import './theme.css'
import './theme-light.css'
import { SiteVersion } from '@/components/site-version'

// v8 · 터미널 — 검은 화면, 형광 초록 글자, 호박색 강조, 전부 고정폭 글꼴. ASCII 상자처럼 그린 패널.
// v6(왼쪽 사이드바) 구조를 그대로 쓰고 모양만 바꾼다. 색·글꼴은 theme.css 맨 위 변수로만 조절한다.
export default function V8Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Nanum+Gothic+Coding:wght@400;700&display=swap"
        precedence="default"
      />
      <div className="v8">
        {children}
        <SiteVersion />
      </div>
    </>
  )
}
