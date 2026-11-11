'use client'

import Link from 'next/link'
import { CrmSessionProvider, useNav, useNow, useSession } from '@/lib/crm/client/hooks'

function TopClock() {
  const now = useNow(1000)
  const t = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
  return (
    <span className="top-clock mono" aria-hidden="true">
      KST {t}
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  return (
    <div className="shell">
      <header className="top">
        <div className="top-inner">
          <Link href={nav[0]?.href || '/v2'} className="top-brand">
            <img src="/logo-ant.png" alt="" width={22} height={22} />
            <strong>여왕개미미디어</strong>
            <span className="mono">CRM</span>
          </Link>
          <nav className="top-nav" aria-label="메뉴">
            {nav.map((item) => (
              <Link key={item.key} href={item.href} className={item.active ? 'on' : ''} aria-current={item.active ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="top-user">
            <TopClock />
            <div className="who">
              <strong>{me.name}</strong>
              <span>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
            </div>
            <button className="key ghost sm" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}

export default function V2ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider
      base="/v2"
      loading={
        <div className="boot">
          <span className="mono">CONNECTING</span>
          <span className="boot-bar" />
          <span className="muted">불러오는 중…</span>
        </div>
      }
    >
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
