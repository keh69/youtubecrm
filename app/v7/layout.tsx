import './theme.css'
import './theme-light.css'

// v7 · SQL 콘솔 — 쿼리 편집기 + 결과 그리드 느낌. v6 의 왼쪽 사이드바 구조를 그대로 쓰고
// 남색 편집기 면, 고정폭 글꼴, 구문 강조 색으로 갈아입혔다. 색·글꼴은 theme.css 맨 위 변수로만 조절한다.
export default function V7Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap"
        precedence="default"
      />
      <div className="v7">
        {children}
      </div>
    </>
  )
}
