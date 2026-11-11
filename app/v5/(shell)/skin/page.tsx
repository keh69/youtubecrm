'use client'

import { useSkins } from '@/lib/crm/client/hooks'
import { PageHead } from '../../_components/ui'

export default function V5Skin() {
  const sk = useSkins()
  return (
    <>
      <PageHead emoji="🎨" title="스킨" desc="화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다." />
      {sk.error && (
        <p className="g-msg error" role="alert">
          {sk.error}
        </p>
      )}
      <section className="g-glass">
        <h2 className="g-h2">스킨 고르기</h2>
        <ul className="g-skin-grid">
          {sk.skins.map((s) => {
            const on = sk.current === s.key
            return (
              <li key={s.key} className={`g-skin-card${on ? ' on' : ''}`}>
                <span className={`g-chip${on ? ' accent' : ''}`}>{s.key}</span>
                <strong>{s.name}</strong>
                <p className="g-muted g-small">{s.description}</p>
                <button className={`g-btn ${on ? 'ghost' : 'primary'} sm`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
                  {on ? '사용 중' : sk.busy === s.key ? '적용 중…' : '적용·저장'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
