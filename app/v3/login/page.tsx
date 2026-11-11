'use client'

import { useLogin } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'

export default function V3Login() {
  const { loginId, setLoginId, password, setPassword, busy, error, submit } = useLogin('/v3')
  return (
    <main className="j-login">
      <div className="login-theme">
        <ThemeToggle className="j-theme" />
      </div>
      <div className="j-login-paper">
        <div className="j-login-plate">
          <span className="j-plate-tag">사내 업무 일지</span>
          <h1 className="j-plate-title">여왕개미미디어</h1>
          <span className="j-plate-sub">CRM · 근태 · 영상 · 통계</span>
        </div>
        <hr className="j-double" />
        <form className="j-login-form" onSubmit={submit}>
          <p className="j-lede center">아이디와 비밀번호로 로그인하세요.</p>
          <label className="j-field">
            <span>아이디</span>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="j-field">
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && (
            <p className="j-note error" role="alert">
              {error}
            </p>
          )}
          <button className="j-btn ink block" disabled={busy}>
            {busy ? '로그인 중…' : '로그인'}
          </button>
          <p className="j-fine center">계정은 관리자가 만들어 드립니다.</p>
        </form>
      </div>
    </main>
  )
}
