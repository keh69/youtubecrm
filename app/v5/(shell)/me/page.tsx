'use client'

import { useChangePassword, useMyContact, useSession } from '@/lib/crm/client/hooks'
import { PageHead } from '../../_components/ui'

export default function V5Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  const contact = useMyContact() // 전화번호·이메일 고치기
  return (
    <>
      <PageHead emoji="🙂" title="내정보" desc="내 계정 정보를 확인하고 전화번호·이메일·비밀번호를 바꿀 수 있습니다." />

      <section className="g-glass">
        <h2 className="g-h2">계정</h2>
        <div className="g-meta-chips">
          <span className="g-chip accent">아이디 {me.loginId}</span>
          <span className="g-chip">이름 {me.name}</span>
          <span className="g-chip">역할 {me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
        </div>
      </section>

      <section className="g-glass">
        <h2 className="g-h2">연락처 수정</h2>
        <form className="g-row-form" onSubmit={contact.submit}>
          <label className="g-field">
            <span>전화번호 (숫자만)</span>
            <input className="g-input" value={contact.phone} onChange={(e) => contact.setPhone(e.target.value)} placeholder="01012345678" maxLength={11} inputMode="numeric" autoComplete="tel" disabled={contact.loading} />
          </label>
          <label className="g-field grow">
            <span>이메일</span>
            <input className="g-input" type="email" value={contact.email} onChange={(e) => contact.setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" disabled={contact.loading} />
          </label>
          <button className="g-btn primary" disabled={contact.busy || contact.loading}>
            {contact.busy ? '저장 중…' : '저장'}
          </button>
        </form>
        {contact.error && (
          <p className="g-msg error" role="alert">
            {contact.error}
          </p>
        )}
        {contact.done && (
          <p className="g-msg ok" role="status">
            전화번호와 이메일을 저장했습니다.
          </p>
        )}
      </section>

      <section className="g-glass">
        <h2 className="g-h2">비밀번호 변경</h2>
        <form className="g-row-form" onSubmit={pw.submit}>
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
