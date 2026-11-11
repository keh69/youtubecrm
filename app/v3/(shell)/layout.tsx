'use client'

import Link from 'next/link'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'

function koreanToday() {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  return (
    <div className="j-page">
      <header className="j-masthead">
        <div className="j-ear">
          <span className="j-ear-date">{koreanToday()}</span>
          <span className="j-ear-user">
            <strong>{me.name}</strong>
            <span className="j-ear-roles">{me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
            <button type="button" className="j-textbtn" onClick={logout}>
              로그아웃
            </button>
          </span>
        </div>
        <hr className="j-rule" />
        <div className="j-plate">
          <span className="j-plate-tag">사내 업무 일지</span>
          <Link href={nav[0]?.href || '/v3'} className="j-plate-title">
            여왕개미미디어
          </Link>
          <span className="j-plate-sub">CRM · 근태 · 영상 · 통계</span>
        </div>
        <hr className="j-double" />
        <nav className="j-nav" aria-label="메뉴">
          {nav.map((item) => (
            <Link key={item.key} href={item.href} className={item.active ? 'active' : ''} aria-current={item.active ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <hr className="j-rule" />
      </header>
      <main className="j-content">{children}</main>
      <footer className="j-colophon">— 여왕개미미디어 사내 업무 일지 —</footer>
    </div>
  )
}

export default function V3ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="/v3" loading={<div className="j-boot">지면을 펼치는 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
