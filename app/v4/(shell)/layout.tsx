'use client'

import Link from 'next/link'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'
import type { MenuKey } from '@/lib/crm/menus'
import { UnresolvedAlert } from '@/components/settings-extra'

const NAV_ICON: Record<MenuKey | 'skin' | 'me', string> = {
  attendance: '⏰',
  attendance_team: '👥',
  videos: '🎬',
  stats: '📊',
  payroll: '💰',
  settings: '⚙',
  skin: '🎨',
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
          {nav.map((item) => {
            const here = item.active && !item.sub?.active
            const link = (
              <Link key={item.key} href={item.href} className={here ? 'active' : item.active ? 'half' : ''} aria-current={here ? 'page' : undefined}>
                <span className="nav-ico" aria-hidden="true">
                  {NAV_ICON[item.key]}
                </span>
                <span className="nav-label">{item.label}</span>
              </Link>
            )
            if (!item.sub) return link
            return (
              <div key={item.key} className={`nav-row${item.active ? ' in' : ''}`}>
                {link}
                <Link
                  href={item.sub.href}
                  className={`nav-sub${item.sub.active ? ' on' : ''}`}
                  aria-current={item.sub.active ? 'page' : undefined}
                  title={item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}
                >
                  {item.sub.label}
                </Link>
              </div>
            )
          })}
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
      {/* 07 미처리 권한이 있으면 미처리가 남아 있는 동안 화면 위에 늘 뜨는 알림 */}
      <UnresolvedAlert base="/v4" />
      <main className="main">
        <div className="theme-slot">
          <ThemeToggle />
        </div>
        {children}
      </main>
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
