import './theme.css'

// v5 · Soft Glass — 파스텔 그라데이션 바탕, 흐릿한 색 덩어리, 반투명 유리 카드, 둥근 알약 UI.
export default function V5Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap" precedence="default" />
      <div className="v5">
        <div className="g-bg" aria-hidden="true">
          <i className="g-blob b1" />
          <i className="g-blob b2" />
          <i className="g-blob b3" />
        </div>
        {children}
      </div>
    </>
  )
}
