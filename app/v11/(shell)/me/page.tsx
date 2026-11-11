'use client'

import { useChangePassword, useSession } from '@/lib/crm/client/hooks'

export default function V11Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  return (
    <>
      <div className="page-head">
        <h1>내정보</h1>
        <p className="warn-banner">
          <span className="warn-ico" aria-hidden="true">
            ⚠
          </span>
          <span>내 계정 정보를 확인하고 비밀번호를 바꿀 수 있습니다.</span>
        </p>
      </div>

      <section className="card">
        <h2>계정</h2>
        <dl className="flag-list">
          <div className="flag">
            <dt className="flag-body">
              <span className="flag-title">아이디</span>
              <code className="flag-id">#account-login-id</code>
            </dt>
            <dd className="flag-ctl mono value">{me.loginId}</dd>
          </div>
          <div className="flag">
            <dt className="flag-body">
              <span className="flag-title">이름</span>
              <code className="flag-id">#account-name</code>
            </dt>
            <dd className="flag-ctl value">{me.name}</dd>
          </div>
          <div className="flag">
            <dt className="flag-body">
              <span className="flag-title">역할</span>
              <code className="flag-id">#account-roles</code>
            </dt>
            <dd className="flag-ctl value">{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>비밀번호 변경</h2>
        <form className="flag-list" onSubmit={pw.submit}>
          <label className="flag">
            <span className="flag-body">
              <span className="flag-title">현재 비밀번호</span>
              <code className="flag-id">#password-current</code>
            </span>
            <span className="flag-ctl">
              <input type="password" value={pw.current} onChange={(e) => pw.setCurrent(e.target.value)} autoComplete="current-password" />
            </span>
          </label>
          <label className="flag">
            <span className="flag-body">
              <span className="flag-title">새 비밀번호 (4자 이상)</span>
              <code className="flag-id">#password-new</code>
            </span>
            <span className="flag-ctl">
              <input type="password" value={pw.next} onChange={(e) => pw.setNext(e.target.value)} autoComplete="new-password" />
            </span>
          </label>
          <label className="flag">
            <span className="flag-body">
              <span className="flag-title">새 비밀번호 확인</span>
              <code className="flag-id">#password-confirm</code>
            </span>
            <span className="flag-ctl">
              <input type="password" value={pw.confirm} onChange={(e) => pw.setConfirm(e.target.value)} autoComplete="new-password" />
            </span>
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
          <div className="flag">
            <div className="flag-body">
              <span className="flag-title">비밀번호 변경 실행</span>
              <code className="flag-id">#password-apply</code>
            </div>
            <div className="flag-ctl">
              <button className="btn primary" disabled={pw.busy}>
                {pw.busy ? '바꾸는 중…' : '비밀번호 변경'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </>
  )
}
