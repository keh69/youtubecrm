'use client'

import Link from 'next/link'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  const roles = me.roles.map((r) => r.name).join(', ') || '역할 없음'
  return (
    <div className="g-app">
      <header className="g-top">
        <div className="g-navpill">
          <Link href={nav[0]?.href || '/v5'} className="g-brand" aria-label="여왕개미미디어 CRM 처음으로">
            <img src="/logo-ant.png" alt="" width={28} height={28} />
            <span>
              여왕개미 <em>CRM</em>
            </span>
          </Link>
          <nav className="g-menu" aria-label="메뉴">
            {nav.map((item) => (
              <Link key={item.key} href={item.href} className={item.active ? 'on' : ''} aria-current={item.active ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="g-user">
            <span className="g-avatar" title={`${me.name} · ${roles}`}>
              {me.name.slice(0, 1) || '?'}
            </span>
            <span className="g-user-text">
              <strong>{me.name}</strong>
              <small>{roles}</small>
            </span>
            <button className="g-btn ghost sm" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="g-content">{children}</main>
    </div>
  )
}

export default function V5ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider
      base="/v5"
      loading={
        <div className="g-boot">
          <span className="g-spinner" aria-hidden="true" />
          불러오는 중…
        </div>
      }
    >
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
