'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo-ant.png" alt="" width={32} height={32} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>CRM</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="메뉴">
          {nav.map((item) => (
            <div key={item.key} className={`nav-row${item.active ? ' active' : ''}`}>
              <Link href={item.href} className={item.active && !item.sub?.active ? 'active' : ''} aria-current={item.active && !item.sub?.active ? 'page' : undefined} onClick={() => setOpen(false)}>
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
                  {item.sub.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
        <div className="side-user">
          <div>
            <strong>{me.name}</strong>
            <span>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
          </div>
          <button className="btn ghost small" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="mobile-top">
          <button className="btn ghost small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            ☰ 메뉴
          </button>
          <strong>여왕개미미디어 CRM</strong>
        </header>
        {open && <div className="side-dim" onClick={() => setOpen(false)} />}
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export default function V1ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="" loading={<div className="boot">불러오는 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
