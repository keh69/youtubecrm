'use client'

import { useChangePassword, useSession } from '@/lib/crm/client/hooks'
import { Ico, Props } from '../../_ui'

export default function V9Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  return (
    <>
      <div className="page-head">
        <h1>내정보</h1>
        <p className="muted">내 계정 정보를 확인하고 비밀번호를 바꿀 수 있습니다.</p>
      </div>

      <section className="card">
        <h2>계정</h2>
        <div style={{ maxWidth: 560 }}>
          <Props
            title="계정"
            rows={[
              { k: '아이디', type: 'text', v: <span className="mono">{me.loginId}</span>, strong: true },
              { k: '이름', type: 'text', v: me.name },
              { k: '역할', type: 'text[]', v: me.roles.map((r) => r.name).join(', ') || '역할 없음' }
            ]}
          />
        </div>
      </section>

      <section className="card">
        <h2>비밀번호 변경</h2>
        <form className="grid-form" onSubmit={pw.submit} style={{ maxWidth: 560, gridTemplateColumns: '1fr' }}>
          <label className="field">
            <span>새 비밀번호 (4자 이상)</span>
            <input type="password" value={pw.next} onChange={(e) => pw.setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>새 비밀번호 확인</span>
            <input type="password" value={pw.confirm} onChange={(e) => pw.setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          {pw.error && (
            <p className="msg error" role="alert">
              {pw.error}
            </p>
          )}
          {pw.done && (
            <p className="msg ok" role="status">
              비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.
            </p>
          )}
          <div className="form-actions">
            <button className="btn primary" disabled={pw.busy}>
              <Ico>✓</Ico> {pw.busy ? '바꾸는 중…' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
