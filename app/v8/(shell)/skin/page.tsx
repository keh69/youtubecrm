'use client'

import { useSkins } from '@/lib/crm/client/hooks'
import { Prompt } from '../../term'

export default function V8Skin() {
  const sk = useSkins()
  return (
    <>
      <div className="page-head">
        <Prompt cmd={'skin --list'} />
        <h1>스킨</h1>
        <p className="muted">화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다.</p>
      </div>
      {sk.error && <p className="msg error" role="alert">{sk.error}</p>}
      <section className="card">
        <h2>스킨 목록</h2>
        <ul className="skin-grid">
          {sk.skins.map((s) => {
            const on = sk.current === s.key
            return (
              <li key={s.key} className={`skin-card${on ? ' on' : ''}`}>
                <span className="skin-key">{s.key}</span>
                <strong>{s.name}</strong>
                <p className="muted small">{s.description}</p>
                <button className={`btn ${on ? 'ghost' : 'primary'} small`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
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
