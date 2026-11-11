'use client'

import { useLogin } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'

export default function V2Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v2')
  return (
    <main className="login">
      <div className="login-grid" aria-hidden="true" />
      <ThemeToggle className="login-theme" />
      <form className="login-term" onSubmit={submit}>
        <div className="login-bar">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span className="login-bar-title">AUTH · 여왕개미미디어 CRM</span>
        </div>
        <div className="login-body">
          <div className="login-brand">
            <img src="/logo-ant.png" alt="" width={36} height={36} />
            <div>
              <strong>여왕개미미디어</strong>
              <span className="mono">CRM CONSOLE</span>
            </div>
          </div>
          <p className="muted small">아이디와 비밀번호로 로그인하세요.</p>
          <label className="fld">
            <span className="lbl">아이디</span>
            <div className="prompt">
              <span className="mono caret">&gt;</span>
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
            </div>
          </label>
          <label className="fld">
            <span className="lbl">비밀번호</span>
            <div className="prompt">
              <span className="mono caret">&gt;</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </label>
          {error && (
            <p className="note bad" role="alert">
              {error}
            </p>
          )}
          <button className="key accent block" disabled={busy}>
            {busy ? '로그인 중…' : '▶ 로그인'}
          </button>
          <p className="muted small center">계정은 관리자가 만들어 드립니다.</p>
        </div>
      </form>
    </main>
  )
}
