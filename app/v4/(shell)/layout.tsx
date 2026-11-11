'use client'

import Link from 'next/link'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'
import type { MenuKey } from '@/lib/crm/menus'

const NAV_ICON: Record<MenuKey | 'me', string> = {
  attendance: '⏰',
  attendance_team: '👥',
  videos: '🎬',
  stats: '📊',
  settings: '⚙',
  me: '👤'
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img src="/logo-ant.png" alt="" width={36} height={36} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>CRM</span>
          </div>
        </div>
        <nav className="nav" aria-label="메뉴">
          {nav.map((item) => (
            <Link key={item.key} href={item.href} className={item.active ? 'active' : ''} aria-current={item.active ? 'page' : undefined}>
              <span className="nav-ico" aria-hidden="true">
                {NAV_ICON[item.key]}
              </span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="user">
          <div className="user-info">
            <strong>{me.name}</strong>
            <span>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
          </div>
          <button className="btn pink sm" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

export default function V4ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider
      base="/v4"
      loading={
        <div className="boot">
          <span className="boot-block">불러오는 중…</span>
        </div>
      }
    >
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
