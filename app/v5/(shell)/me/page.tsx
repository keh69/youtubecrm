'use client'

import { useChangePassword, useSession } from '@/lib/crm/client/hooks'
import { PageHead } from '../../_components/ui'

export default function V5Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  return (
    <>
      <PageHead emoji="🙂" title="내정보" desc="내 계정 정보를 확인하고 비밀번호를 바꿀 수 있습니다." />

      <section className="g-glass">
        <h2 className="g-h2">계정</h2>
        <div className="g-meta-chips">
          <span className="g-chip accent">아이디 {me.loginId}</span>
          <span className="g-chip">이름 {me.name}</span>
          <span className="g-chip">역할 {me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
        </div>
      </section>

      <section className="g-glass">
        <h2 className="g-h2">비밀번호 변경</h2>
        <form className="g-row-form" onSubmit={pw.submit}>
          <label className="g-field">
            <span>현재 비밀번호</span>
            <input className="g-input" type="password" value={pw.current} onChange={(e) => pw.setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="g-field">
            <span>새 비밀번호 (4자 이상)</span>
            <input className="g-input" type="password" value={pw.next} onChange={(e) => pw.setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="g-field">
            <span>새 비밀번호 확인</span>
            <input className="g-input" type="password" value={pw.confirm} onChange={(e) => pw.setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="g-btn primary" disabled={pw.busy}>
            {pw.busy ? '바꾸는 중…' : '비밀번호 변경'}
          </button>
        </form>
        {pw.error && <p className="g-msg error" role="alert">{pw.error}</p>}
        {pw.done && <p className="g-msg ok" role="status">비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</p>}
      </section>
    </>
  )
}
