'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/lib/crm/client/theme'

type Group = { role: string; people: Array<{ id: string; name: string; loginId: string }> }
const EMPTY = { loginId: '', password: '', name: '', email: '', phone: '', affiliationUserId: '', website: '' }

// 회원가입: 설정 > 04 아이디 만들기와 같은 칸(아이디, 비밀번호, 이름, 이메일(선택), 전화번호, 소속).
// 로그인 없이 열리고, 가입하면 바로 그 아이디로 로그인할 수 있다(기본 역할 '직원').
export default function V5Signup() {
  const [form, setForm] = useState(EMPTY)
  const [groups, setGroups] = useState<Group[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/signup', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setGroups(Array.isArray(j.groups) ? j.groups : []))
      .catch(() => setGroups([]))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.loginId.trim() || !form.password || !form.name.trim()) {
      setError('아이디, 비밀번호, 이름은 꼭 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, affiliationUserId: form.affiliationUserId || null })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setError(j.error || '가입하지 못했습니다.')
      else {
        setDone(j.loginId || form.loginId)
        setForm(EMPTY)
      }
    } catch {
      setError('인터넷 연결을 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="g-login">
      <ThemeToggle className="g-theme g-login-theme" />
      <div className="g-glass g-login-card g-signup-card">
        <div className="g-login-logo">
          <img src="/logo-ant.png" alt="" width={44} height={44} />
        </div>
        <h1>회원가입</h1>

        {done ? (
          <>
            <p className="g-msg ok" role="status">
              &lsquo;{done}&rsquo; 아이디가 만들어졌습니다. 이제 로그인할 수 있습니다.
            </p>
            <Link href="/v5/login" className="g-btn primary block lg">
              로그인하러 가기
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="g-signup-form">
            <p className="g-muted g-small">여기서 만든 아이디와 비밀번호로 바로 로그인할 수 있습니다. 새 아이디는 기본으로 &lsquo;직원&rsquo; 역할을 받습니다.</p>
            <div className="g-grid-form">
              <label className="g-field">
                <span>아이디 (ID) *</span>
                <input className="g-input" value={form.loginId} onChange={(e) => set('loginId', e.target.value)} autoComplete="username" placeholder="영문/숫자" autoFocus />
              </label>
              <label className="g-field">
                <span>비밀번호 (PW) *</span>
                <input className="g-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" placeholder="4자 이상" />
              </label>
              <label className="g-field">
                <span>이름 *</span>
                <input className="g-input" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
              </label>
              <label className="g-field">
                <span>이메일 (선택)</span>
                <input className="g-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
              </label>
              <label className="g-field">
                <span>전화번호</span>
                <input className="g-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" />
              </label>
              <label className="g-field">
                <span>소속</span>
                <select className="g-input" value={form.affiliationUserId} onChange={(e) => set('affiliationUserId', e.target.value)}>
                  <option value="">소속 없음</option>
                  {groups.map((g) => (
                    <optgroup key={g.role} label={g.role}>
                      {g.people.map((u) => (
                        <option key={`${g.role}-${u.id}`} value={u.id}>
                          {u.name} ({u.loginId})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            {/* 봇 막기용 숨은 칸: 사람에게는 보이지 않는다 */}
            <input className="g-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => set('website', e.target.value)} />
            {error && (
              <p className="g-msg error" role="alert">
                {error}
              </p>
            )}
            <button className="g-btn primary block lg" disabled={busy}>
              {busy ? '만드는 중…' : '아이디 생성'}
            </button>
          </form>
        )}

        <p className="g-muted g-small g-center">
          이미 아이디가 있나요? <Link href="/v5/login">로그인</Link>
        </p>
      </div>
    </main>
  )
}
