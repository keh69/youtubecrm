'use client'

import Link from 'next/link'
import { useLogin } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'

export default function V5Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v5')
  return (
    <main className="g-login">
      <ThemeToggle className="g-theme g-login-theme" />
      <form className="g-glass g-login-card" onSubmit={submit}>
        <div className="g-login-logo">
          <img src="/logo-ant.png" alt="" width={44} height={44} />
        </div>
        <h1>여왕개미미디어 CRM</h1>
        <p className="g-muted">아이디와 비밀번호로 로그인하세요.</p>
        <label className="g-field">
          <span>아이디</span>
          <input className="g-input" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="g-field">
          <span>비밀번호</span>
          <input className="g-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && (
          <p className="g-msg error" role="alert">
            {error}
          </p>
        )}
        <button className="g-btn primary block lg" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
        <p className="g-muted g-small g-center">
          아이디가 없나요? <Link href="/v5/signup">회원가입</Link>
        </p>
      </form>
    </main>
  )
}
