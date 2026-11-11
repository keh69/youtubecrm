'use client'

import { useSkins } from '@/lib/crm/client/hooks'
import { PageHead, Panel } from '../../_components/ui'

export default function V2Skin() {
  const sk = useSkins()
  return (
    <>
      <PageHead code="USR-02" title="스킨" desc="화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다." />
      {sk.error && (
        <p className="note bad" role="alert">
          {sk.error}
        </p>
      )}
      <Panel label="스킨 목록" right={<span className="mono">{sk.skins.length} ITEMS</span>}>
        <ul className="skin-list">
          {sk.skins.map((s) => {
            const on = sk.current === s.key
            return (
              <li key={s.key} className={`skin-item${on ? ' on' : ''}`}>
                <span className="skin-key mono">{s.key.toUpperCase()}</span>
                <div className="skin-body">
                  <strong>
                    {s.name}
                    {on && <span className="tag tone-ok">ACTIVE</span>}
                  </strong>
                  <p className="hint">{s.description}</p>
                </div>
                <button className={`key ${on ? 'ghost' : 'accent'} sm`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
                  {on ? '사용 중' : sk.busy === s.key ? '적용 중…' : '▶ 적용·저장'}
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>
    </>
  )
}
