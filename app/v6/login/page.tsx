'use client'

import { useLogin } from '@/lib/crm/client/hooks'

export default function V6Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v6')
  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/logo-ant.png" alt="" width={36} height={36} className="login-logo" />
          <span className="label">CRM · SIGN IN</span>
        </div>
        <h1>여왕개미미디어 CRM</h1>
        <p className="muted">아이디와 비밀번호로 로그인하세요.</p>
        <label className="field">
          <span>아이디</span>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="msg error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
        <p className="muted small center">계정은 관리자가 만들어 드립니다.</p>
      </form>
    </main>
  )
}
