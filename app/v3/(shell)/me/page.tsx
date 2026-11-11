'use client'

import { useChangePassword, useSession } from '@/lib/crm/client/hooks'
import { PageHead } from '../../_components/ui'

export default function V3Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  return (
    <>
      <PageHead kicker="인물란" title="내정보">
        내 계정 정보를 확인하고 비밀번호를 바꿀 수 있습니다.
      </PageHead>

      <section className="j-section">
        <h2 className="j-h2">계정</h2>
        <p className="j-byline">
          아이디 <strong>{me.loginId}</strong> · 이름 <strong>{me.name}</strong> · 역할 <strong>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</strong>
        </p>
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <h2 className="j-h2">비밀번호 변경</h2>
        <form className="j-form-row" onSubmit={pw.submit}>
          <label className="j-field">
            <span>새 비밀번호 (4자 이상)</span>
            <input type="password" value={pw.next} onChange={(e) => pw.setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="j-field">
            <span>새 비밀번호 확인</span>
            <input type="password" value={pw.confirm} onChange={(e) => pw.setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="j-btn ink" disabled={pw.busy}>
            {pw.busy ? '바꾸는 중…' : '비밀번호 변경'}
          </button>
        </form>
        {pw.error && <p className="j-note error" role="alert">{pw.error}</p>}
        {pw.done && <p className="j-note ok" role="status">비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</p>}
      </section>
    </>
  )
}
