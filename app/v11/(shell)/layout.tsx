'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  const current = nav.find((n) => n.active)
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo-ant.png" alt="" width={28} height={28} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>crm://flags</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="메뉴">
          {nav.map((item) => (
            <Link key={item.key} href={item.href} className={item.active ? 'active' : ''} aria-current={item.active ? 'page' : undefined} onClick={() => setOpen(false)}>
              <span className="nav-dot" aria-hidden="true" />
              {item.label}
            </Link>
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
        <div className="flags-bar">
          <div className="omnibox" aria-label="현재 화면">
            <span className="omni-ico" aria-hidden="true">
              ⌕
            </span>
            <code>crm://flags/{current ? current.path.replace(/^\//, '') : ''}</code>
            {current && <span className="omni-label">{current.label}</span>}
          </div>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export default function V11ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="/v11" loading={<div className="boot">불러오는 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
