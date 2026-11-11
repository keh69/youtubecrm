import './theme.css'
import './theme-light.css'

// v1 · Office Classic — 밝은 회색 바탕, 흰 사이드바, 남색(인디고) 포인트, 단정한 카드.
export default function V1Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" precedence="default" />
      <div className="v1">
        {children}
      </div>
    </>
  )
}
