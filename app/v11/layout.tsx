import './theme.css'

// v11 · 크롬 플래그 — 브라우저 실험 기능 설정 화면 느낌. 흰 바탕, 파란 포인트, "플래그" 행 목록.
export default function V11Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
        precedence="default"
      />
      <div className="v11">
        {children}
      </div>
    </>
  )
}
