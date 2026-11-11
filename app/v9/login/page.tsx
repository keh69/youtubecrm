'use client'

import { useLogin } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'
import { Ico } from '../_ui'

export default function V9Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v9')
  return (
    <main className="login-wrap">
      <ThemeToggle className="tb-btn tb-theme login-theme" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-titlebar">
          <span aria-hidden="true">🗄</span>
          <span>데이터베이스 연결</span>
          <span className="ty">crm_db</span>
        </div>
        <div className="login-body">
          <div className="login-brand">
            <img src="/logo-ant.png" alt="" width={32} height={32} className="login-logo" />
            <div>
              <h1>여왕개미미디어 CRM</h1>
              <p className="muted small">아이디와 비밀번호로 로그인하세요.</p>
            </div>
          </div>
          <div className="login-props">
            <span className="muted small">호스트</span>
            <span className="mono">crm_db · 사내</span>
          </div>
          <label className="field">
            <span>
              아이디 <span className="ty">user</span>
            </span>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="field">
            <span>
              비밀번호 <span className="ty">password</span>
            </span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && (
            <p className="msg error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary block" disabled={busy}>
            <Ico>⏎</Ico> {busy ? '로그인 중…' : '로그인'}
          </button>
          <p className="muted small center">아이디가 없나요? <a href="/v5/signup" className="xs-signup-link">회원가입</a></p>
        </div>
      </form>
    </main>
  )
}
