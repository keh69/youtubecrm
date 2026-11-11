'use client'

import { useSkins } from '@/lib/crm/client/hooks'

export default function V11Skin() {
  const sk = useSkins()
  return (
    <>
      <div className="page-head">
        <h1>스킨</h1>
        <p className="warn-banner">
          <span className="warn-ico" aria-hidden="true">
            ⚠
          </span>
          <span>화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다.</span>
        </p>
      </div>
      {sk.error && (
        <p className="msg error" role="alert">
          {sk.error}
        </p>
      )}
      <section className="card">
        <div className="section-tabs" aria-hidden="true">
          <span className="on">사용 가능</span>
        </div>
        <ul className="flag-list skin-grid">
          {sk.skins.map((s) => {
            const on = sk.current === s.key
            return (
              <li key={s.key} className={`flag skin-card${on ? ' on' : ''}`}>
                <div className="flag-body">
                  <span className="flag-title">
                    {on && <span className="mod-dot" aria-hidden="true" />}
                    {s.name}
                  </span>
                  <span className="flag-desc">{s.description}</span>
                  <code className="flag-id">#skin-{s.key}</code>
                </div>
                <div className="flag-ctl">
                  <button className={`btn ${on ? 'ghost' : 'primary'} small`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
                    {on ? '사용 중' : sk.busy === s.key ? '적용 중…' : '적용·저장'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
