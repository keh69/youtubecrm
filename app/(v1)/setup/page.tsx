'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// 최초 설치: 계정이 하나도 없을 때 총 관리자 계정을 만든다(한 번만).
export default function SetupPage() {
  const [state, setState] = useState<{ needed: boolean; codeRequired: boolean } | null>(null)
  const [form, setForm] = useState({ setupCode: '', loginId: '', password: '', name: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => setState(d.error ? { needed: false, codeRequired: false } : d))
      .catch(() => setError('서버에 연결할 수 없습니다.'))
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error || '만들지 못했습니다.')
    setDone(true)
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <img src="/logo-ant.png" alt="" width={48} height={48} className="login-logo" />
        <h1>최초 관리자 만들기</h1>
        {!state ? (
          <p className="muted">확인 중…</p>
        ) : done ? (
          <>
            <p className="msg ok">총 관리자 계정을 만들었습니다.</p>
            <Link className="btn primary block center" href="/login">
              로그인하러 가기
            </Link>
          </>
        ) : !state.needed ? (
          <>
            <p className="muted">이미 설치가 끝났습니다. 계정은 관리자가 설정 → 아이디생성에서 만듭니다.</p>
            <Link className="btn primary block center" href="/login">
              로그인
            </Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="muted small">처음 한 번만 보이는 화면입니다. 여기서 만든 계정이 모든 권한을 가진 총 관리자가 됩니다.</p>
            {state.codeRequired && (
              <label className="field">
                <span>설치 코드</span>
                <input value={form.setupCode} onChange={set('setupCode')} autoComplete="off" />
              </label>
            )}
            <label className="field">
              <span>아이디</span>
              <input value={form.loginId} onChange={set('loginId')} autoComplete="username" />
            </label>
            <label className="field">
              <span>비밀번호 (6자 이상)</span>
              <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </label>
            <label className="field">
              <span>이름</span>
              <input value={form.name} onChange={set('name')} />
            </label>
            <label className="field">
              <span>이메일</span>
              <input type="email" value={form.email} onChange={set('email')} />
            </label>
            <label className="field">
              <span>전화번호 (선택)</span>
              <input value={form.phone} onChange={set('phone')} inputMode="tel" />
            </label>
            {error && <p className="msg error">{error}</p>}
            <button className="btn primary block" disabled={busy}>
              {busy ? '만드는 중…' : '총 관리자 만들기'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
