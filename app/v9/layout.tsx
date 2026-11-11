import './theme.css'
import './theme-light.css'

// v9 · DB 관리 도구 — 밝은 데스크톱 앱 크롬, 객체 트리 사이드바, 탭 바, 속성 패널, 데이터 그리드.
// v6 사이드바 레이아웃을 바탕으로 한다. 색·글꼴·모서리는 theme.css 맨 위 변수로만 조절한다.
export default function V9Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&display=swap"
        precedence="default"
      />
      <div className="v9">
        {children}
      </div>
    </>
  )
}
