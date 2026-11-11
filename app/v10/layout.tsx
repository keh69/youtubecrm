import './theme.css'

// v10 · 코드 에디터 — 개발자 에디터(IDE) 화면 느낌.
// 왼쪽 활동 막대 + 탐색기(파일 트리) 사이드바, 위쪽 파란 상태 막대와 에디터 탭, 어두운 패널.
// 색·글꼴·모서리는 theme.css 맨 위 변수로만 조절한다.
export default function V10Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        precedence="default"
      />
      <div className="v10">{children}</div>
    </>
  )
}
