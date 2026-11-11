'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, base, logout } = useSession()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  const current = nav.find((n) => n.active)
  // [통계] 화면(직원근태·영상통계)에 있으면 주소창에는 그 화면의 경로·이름을 띄운다
  const view = current?.sub?.active
    ? { path: current.sub.href.slice(base.length), label: current.sub.key === 'attendance_team' ? '직원근태 > 근태통계' : '영상통계' }
    : current
      ? { path: current.path, label: current.label }
      : undefined
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
          {nav.map((item) => {
            const self = item.active && !item.sub?.active
            return (
              <div key={item.key} className={`nav-row${item.active ? ' on' : ''}`}>
                <Link href={item.href} className={self ? 'active' : item.active ? 'parent' : ''} aria-current={self ? 'page' : undefined} onClick={() => setOpen(false)}>
                  <span className="nav-dot" aria-hidden="true" />
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
            )
          })}
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
            <code>crm://flags/{view ? view.path.replace(/^\//, '') : ''}</code>
            {view && <span className="omni-label">{view.label}</span>}
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
