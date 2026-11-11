'use client'

import { useLogin } from '@/lib/crm/client/hooks'
import { PromptLine } from '../term'
import { ThemeToggle } from '@/lib/crm/client/theme'

export default function V8Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v8')
  return (
    <main className="login-wrap">
      <ThemeToggle className="login-theme" />
      <form className="login-card card" onSubmit={submit}>
        <h2>login</h2>
        <pre className="login-banner" aria-hidden="true">{`QUEEN-ANT MEDIA CRM  v8\ntty1 · secure shell`}</pre>
        <PromptLine user="guest" cmd="login" />
        <h1>여왕개미미디어 CRM</h1>
        <p className="muted"># 아이디와 비밀번호로 로그인하세요.</p>
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
        <p className="muted small center">아이디가 없나요? <a href="/v5/signup" className="xs-signup-link">회원가입</a></p>
      </form>
    </main>
  )
}
