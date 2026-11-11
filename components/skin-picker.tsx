'use client'

import { useSkinCookie } from '@/lib/crm/client/hooks'

// 설정 → 05 스킨: v1~v11 중 하나를 골라 "이 컴퓨터"에 저장한다(쿠키, 5년).
// 저장하면 바로 그 스킨으로 다시 열리고, 이 컴퓨터로 홈페이지에 들어오면 계속 그 스킨으로 보인다.
// 모든 스킨에서 같은 부품을 쓴다(색은 블랙/화이트 테마를 따라감, globals.css .skin-pick).
export function SkinPicker() {
  const sk = useSkinCookie()
  return (
    <section className="skin-pick" aria-label="스킨 고르기">
      <p className="skin-pick-note">
        고른 스킨은 <strong>이 컴퓨터(이 브라우저)</strong>에 저장됩니다. 다른 컴퓨터에는 영향이 없고, 기본은 v5입니다.
      </p>
      <ul className="skin-pick-grid">
        {sk.skins.map((s) => {
          const on = sk.current === s.key
          return (
            <li key={s.key} className={`skin-pick-card${on ? ' on' : ''}`}>
              <span className="skin-pick-key">{s.key}</span>
              <strong>{s.name}</strong>
              <span className="skin-pick-desc">{s.description}</span>
              <button type="button" disabled={on} onClick={() => sk.apply(s.key)}>
                {on ? '사용 중' : '이 스킨으로 저장'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
