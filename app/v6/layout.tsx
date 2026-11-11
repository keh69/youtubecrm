import './theme.css'

// v6 · 심플 사이드바 — 검은 사이드바, 흰 본문, 초록 포인트 하나, 1px 실선, 숫자는 고정폭 글꼴.
// v7~v10 스킨의 바탕이 되는 기본형. 색·글꼴·모서리는 theme.css 맨 위 변수로만 조절한다.
export default function V6Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        precedence="default"
      />
      <div className="v6">{children}</div>
    </>
  )
}
