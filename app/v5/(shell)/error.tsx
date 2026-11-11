'use client'

import { useEffect } from 'react'

// v5 화면에서 예상하지 못한 오류가 나도 페이지 전체가 멈추지 않고, 메뉴는 그대로 둔 채 이 안내만 보여 준다.
export default function V5Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('화면 오류', error)
  }, [error])
  return (
    <section className="g-glass" role="alert">
      <h2 className="g-h2">화면을 불러오지 못했습니다</h2>
      <p className="g-muted g-small">잠시 후 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.</p>
      <div className="g-editor-actions">
        <button className="g-btn primary" onClick={reset}>
          다시 시도
        </button>
        <button className="g-btn ghost" onClick={() => window.location.reload()}>
          새로고침
        </button>
      </div>
    </section>
  )
}
