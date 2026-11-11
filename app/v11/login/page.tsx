'use client'

import { useEffect, useState } from 'react'
import { useLogin } from '@/lib/crm/client/hooks'

export default function V11Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v11')
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
        <div className="login-head">
          <img src="/logo-ant.png" alt="" width={40} height={40} className="login-logo" />
          <div>
            <h1>여왕개미미디어 CRM</h1>
            <code className="flag-id">crm://flags/login</code>
          </div>
        </div>
        <p className="warn-banner">
          <span className="warn-ico" aria-hidden="true">
            ⚠
          </span>
          <span>아이디와 비밀번호로 로그인하세요.</span>
        </p>
        <div className="flag-list">
          <label className="flag">
            <span className="flag-body">
              <span className="flag-title">아이디</span>
              <code className="flag-id">#login-id</code>
            </span>
            <span className="flag-ctl">
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
            </span>
          </label>
          <label className="flag">
            <span className="flag-body">
              <span className="flag-title">비밀번호</span>
              <code className="flag-id">#login-password</code>
            </span>
            <span className="flag-ctl">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </span>
          </label>
        </div>
        {error && (
          <p className="msg error" role="alert">
            {error}
          </p>
        )}
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
