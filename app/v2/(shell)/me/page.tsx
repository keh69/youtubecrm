'use client'

import { useChangePassword, useSession } from '@/lib/crm/client/hooks'
import { PageHead, Panel } from '../../_components/ui'

export default function V2Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  return (
    <>
      <PageHead code="USR-01" title="내정보" desc="내 계정 정보를 확인하고 비밀번호를 바꿀 수 있습니다." />

      <Panel label="계정">
        <dl className="kv">
          <div>
            <dt>아이디</dt>
            <dd className="mono">{me.loginId}</dd>
          </div>
          <div>
            <dt>이름</dt>
            <dd>{me.name}</dd>
          </div>
          <div>
            <dt>역할</dt>
            <dd>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</dd>
          </div>
        </dl>
      </Panel>

      <Panel label="비밀번호 변경">
        <form className="cmd-form" onSubmit={pw.submit}>
          <label className="fld">
            <span className="lbl">현재 비밀번호</span>
            <input type="password" value={pw.current} onChange={(e) => pw.setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="fld">
            <span className="lbl">새 비밀번호 (4자 이상)</span>
            <input type="password" value={pw.next} onChange={(e) => pw.setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="fld">
            <span className="lbl">새 비밀번호 확인</span>
            <input type="password" value={pw.confirm} onChange={(e) => pw.setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="key accent" disabled={pw.busy}>
            {pw.busy ? '변경 중…' : '▶ 비밀번호 변경'}
          </button>
        </form>
        {pw.error && <p className="note bad" role="alert">{pw.error}</p>}
        {pw.done && <p className="note good" role="status">비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</p>}
      </Panel>
    </>
  )
}
