'use client'

import { useSkins } from '@/lib/crm/client/hooks'
import { PageHead } from '../../_components/ui'

export default function V3Skin() {
  const sk = useSkins()
  return (
    <>
      <PageHead kicker="지면 안내" title="스킨">
        화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다.
      </PageHead>

      {sk.error && (
        <p className="j-note error" role="alert">
          {sk.error}
        </p>
      )}

      <section className="j-section">
        <h2 className="j-h2">판형 고르기</h2>
        <ol className="j-skin-list">
          {sk.skins.map((s) => {
            const on = sk.current === s.key
            return (
              <li key={s.key} className={on ? 'on' : ''}>
                <span className="j-skin-key">{s.key}</span>
                <div className="j-skin-body">
                  <h3>{s.name}</h3>
                  <p className="j-aside">{s.description}</p>
                </div>
                <button type="button" className={`j-btn ${on ? 'plain' : 'ink'} small`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
                  {on ? '사용 중' : sk.busy === s.key ? '적용 중…' : '적용·저장'}
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}
