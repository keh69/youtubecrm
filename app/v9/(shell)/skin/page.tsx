'use client'

import { useSkins } from '@/lib/crm/client/hooks'
import { GridFoot, Ico, RowNoTh, Th } from '../../_ui'

export default function V9Skin() {
  const sk = useSkins()
  return (
    <>
      <div className="page-head">
        <h1>스킨</h1>
        <p className="muted">화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다.</p>
      </div>
      {sk.error && (
        <p className="msg error" role="alert">
          {sk.error}
        </p>
      )}
      <section className="card">
        <h2>스킨 목록</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <RowNoTh />
                <Th name="key" type="varchar" />
                <Th name="이름" type="text" />
                <Th name="설명" type="text" />
                <Th name="사용" type="bool" className="center" />
                <th />
              </tr>
            </thead>
            <tbody>
              {sk.skins.map((s, i) => {
                const on = sk.current === s.key
                return (
                  <tr key={s.key} className={on ? 'selected' : ''}>
                    <td className="rn">{i + 1}</td>
                    <td className="mono nowrap">{s.key}</td>
                    <td className="nowrap">
                      <strong>{s.name}</strong>
                    </td>
                    <td className="muted small">{s.description}</td>
                    <td className="center mono">{on ? <span className="badge tone-ok">true</span> : <span className="null">false</span>}</td>
                    <td className="right">
                      <button className={`btn ${on ? 'ghost' : 'primary'} small`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
                        {!on && <Ico>✓</Ico>} {on ? '사용 중' : sk.busy === s.key ? '적용 중…' : '적용·저장'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <GridFoot count={sk.skins.length} />
      </section>
    </>
  )
}
