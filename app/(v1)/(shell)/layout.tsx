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
          <img src="/logo-ant.png" alt="" width={32} height={32} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>CRM</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="메뉴">
          {nav.map((item) => {
            // 하위 메뉴(영상등록 → 통계 · 통계비교). 하위 메뉴가 켜져 있으면 부모는 '여기'가 아니다
            const subs = item.subs ?? (item.sub ? [item.sub] : [])
            const here = item.active && !subs.some((x) => x.active)
            return (
              <div key={item.key} className={`nav-row${item.active ? ' active' : ''}`}>
                <Link href={item.href} className={here ? 'active' : ''} aria-current={here ? 'page' : undefined} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
                {subs.map((sub) => (
                  <Link
                    key={sub.key}
                    href={sub.href}
                    className={`nav-sub${sub.active ? ' on' : ''}`}
                    aria-current={sub.active ? 'page' : undefined}
                    title={sub.key === 'stats_compare' ? '기간·직원 비교 차트' : item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}
                    onClick={() => setOpen(false)}
                  >
                    {sub.label}
                  </Link>
                ))}
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
        <div className="theme-slot">
          <ThemeToggle />
        </div>
        <header className="mobile-top">
          <button className="btn ghost small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            ☰ 메뉴
          </button>
          <strong>여왕개미미디어 CRM</strong>
        </header>
        {open && <div className="side-dim" onClick={() => setOpen(false)} />}
        {/* 07 미처리 권한이 있으면 미처리가 남아 있는 동안 화면 위에 늘 뜨는 알림 */}
        <UnresolvedAlert base="" />
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
