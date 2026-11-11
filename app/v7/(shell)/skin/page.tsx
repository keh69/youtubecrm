'use client'

import { useSession, useSkins } from '@/lib/crm/client/hooks'
import { GridStatus, SqlQuery, sqlStr } from '../../_ui/sql'

export default function V7Skin() {
  const { me } = useSession()
  const sk = useSkins()
  const query = [
    '-- 화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다.',
    '-- 기능은 모든 스킨이 같습니다.',
    `UPDATE users SET skin = ${sqlStr(sk.current)}`,
    ` WHERE login_id = ${sqlStr(me.loginId)};`
  ].join('\n')
  return (
    <>
      <div className="page-head">
        <h1>스킨</h1>
        <SqlQuery file="skins.sql" code={query} />
      </div>
      {sk.error && (
        <p className="msg error" role="alert">
          {sk.error}
        </p>
      )}
      <section className="card">
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
        <GridStatus rows={sk.skins.length}>현재 skin = {sk.current}</GridStatus>
      </section>
    </>
  )
}
