'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useSession, type NavItem } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'
import { UnresolvedAlert } from '@/components/settings-extra'

// 메뉴 → 스키마 트리의 "테이블 이름" (장식용)
const TABLE: Record<NavItem['key'], string> = {
  attendance: 'attendance',
  attendance_team: 'team_attendance',
  videos: 'videos',
  stats: 'video_stats',
  stats_compare: 'stats_compare',
  payroll: 'payroll',
  settings: 'settings',
  skin: 'skins',
  me: 'me'
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  const dataItems = nav.filter((i) => i.key !== 'skin' && i.key !== 'me')
  const sysItems = nav.filter((i) => i.key === 'skin' || i.key === 'me')

  // 메뉴 한 줄 = 테이블 노드 + (있으면) 옆에 붙는 [통계] 뷰 버튼
  const item = (i: NavItem) => {
    const self = i.active && !i.sub?.active
    return (
      <div key={i.key} className={`tree-row${i.active ? ' on' : ''}`}>
        <Link href={i.href} className={self ? 'active' : i.active ? 'parent' : ''} aria-current={self ? 'page' : undefined} onClick={() => setOpen(false)}>
          <span className="tw" aria-hidden="true">
            {i.active ? '▾' : '▸'}
          </span>
          <span className="tree-ico" aria-hidden="true">
            ⊞
          </span>
          <span className="tree-label">{i.label}</span>
          <span className="tree-tbl" aria-hidden="true">
            {TABLE[i.key]}
          </span>
        </Link>
        {i.sub && (
          <Link
            href={i.sub.href}
            className={`tree-sub${i.sub.active ? ' on' : ''}`}
            aria-current={i.sub.active ? 'page' : undefined}
            title={i.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}
            onClick={() => setOpen(false)}
          >
            <span className="tree-sub-ico" aria-hidden="true">
              Σ
            </span>
            {i.sub.label}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo-ant.png" alt="" width={28} height={28} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>crm · SQL 콘솔</span>
          </div>
        </div>
        <div className="conn">
          <span className="conn-dot" aria-hidden="true" />
          연결됨 <span className="conn-db">{me.loginId}@crm</span>
        </div>
        <span className="side-label">스키마 탐색기</span>
        <nav className="side-nav" aria-label="메뉴">
          <div className="tree-root" aria-hidden="true">
            <span className="tw">▾</span> <span className="tree-db">▤</span> crm
          </div>
          <div className="tree-group">{dataItems.map(item)}</div>
          {sysItems.length > 0 && (
            <>
              <div className="tree-root" aria-hidden="true">
                <span className="tw">▾</span> <span className="tree-db">▤</span> sys
              </div>
              <div className="tree-group">{sysItems.map(item)}</div>
            </>
          )}
        </nav>
        <div className="side-user">
          <div>
            <strong>{me.name}</strong>
            <span>{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
          </div>
          <button className="btn ghost small" onClick={logout}>
            ⏻ 로그아웃
          </button>
        </div>
      </aside>
      <div className="main">
        <ThemeToggle className="desk-theme" />
        <header className="mobile-top">
          <button className="btn ghost small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            ☰ 메뉴
          </button>
          <strong>
            <span className="t-kw">crm</span>&gt; 여왕개미미디어 CRM
          </strong>
          <ThemeToggle className="mobile-theme" />
        </header>
        {open && <div className="side-dim" onClick={() => setOpen(false)} />}
        {/* 07 미처리 권한이 있으면 미처리가 남아 있는 동안 화면 위에 늘 뜨는 알림 */}
        <UnresolvedAlert base="/v7" />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export default function V7ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="/v7" loading={<div className="boot">불러오는 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
