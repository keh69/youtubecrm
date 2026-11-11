'use client'

import { useEffect, useState } from 'react'
import { useLogin } from '@/lib/crm/client/hooks'

export default function V1Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('')
  const [setupNeeded, setSetupNeeded] = useState(false)
  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => setSetupNeeded(Boolean(d.needed)))
      .catch(() => {})
  }, [])
  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo-ant.png" alt="" width={48} height={48} className="login-logo" />
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
        {setupNeeded && (
          <a className="btn ghost block center" href="/setup">
            처음 설치: 최초 관리자 만들기
          </a>
        )}
      </form>
    </main>
  )
}
