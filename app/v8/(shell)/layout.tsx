'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'
import { UnresolvedAlert } from '@/components/settings-extra'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo-ant.png" alt="" width={28} height={28} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>crm v8 · tty1</span>
          </div>
        </div>
        <span className="side-label">$ ls ./menu</span>
        <nav className="side-nav" aria-label="메뉴">
          {nav.map((item) => {
            const self = item.active && !item.sub?.active
            return (
              <div key={item.key} className={`nav-row${item.active ? ' on' : ''}`}>
                <Link href={item.href} className={self ? 'active' : item.active ? 'parent' : ''} aria-current={self ? 'page' : undefined} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
                {item.sub && (
                  <Link
                    href={item.sub.href}
                    className={`nav-sub${item.sub.active ? ' on' : ''}`}
                    aria-current={item.sub.active ? 'page' : undefined}
                    title={item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}
                    onClick={() => setOpen(false)}
                  >
                    [{item.sub.label}]
                  </Link>
                )}
              </div>
            )
          })}
        </nav>
        <div className="side-user">
          <div>
            <strong>{me.name}</strong>
            <span>uid={me.loginId}</span>
            <span>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
          </div>
          <button className="btn ghost small" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>
      <div className="main">
        <ThemeToggle className="desk-theme" />
        <header className="mobile-top">
          <button className="btn ghost small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            ☰ 메뉴
          </button>
          <strong>{me.loginId}@crm</strong>
          <ThemeToggle className="mobile-theme" />
        </header>
        {open && <div className="side-dim" onClick={() => setOpen(false)} />}
        {/* 07 미처리 권한이 있으면 미처리가 남아 있는 동안 화면 위에 늘 뜨는 알림 */}
        <UnresolvedAlert base="/v8" />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export default function V8ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="/v8" loading={<div className="boot">불러오는 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
