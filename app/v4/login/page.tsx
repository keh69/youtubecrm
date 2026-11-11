'use client'

import { useLogin } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'
import { Msg } from '../_components/ui'

export default function V4Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v4')
  return (
    <main className="login">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <div className="login-deco deco-a" aria-hidden="true" />
      <div className="login-deco deco-b" aria-hidden="true" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/logo-ant.png" alt="" width={56} height={56} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>CRM</span>
          </div>
          <span className="login-sticker" aria-hidden="true">
            오늘도 화이팅!
          </span>
        </div>
        <div className="login-body">
          <h1>로그인</h1>
          <p className="sub">아이디와 비밀번호로 로그인하세요.</p>
          <label className="field">
            <span>아이디</span>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && (
            <Msg tone="error" live="alert">
              {error}
            </Msg>
          )}
          <button className="btn yellow xl full" disabled={busy}>
            {busy ? '로그인 중…' : '로그인 →'}
          </button>
          <p className="login-note">아이디가 없나요? <a href="/v5/signup" className="xs-signup-link">회원가입</a></p>
        </div>
      </form>
    </main>
  )
}
