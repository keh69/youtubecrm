'use client'

import Link from 'next/link'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'

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
            {nav.map((item) => {
              const here = item.active && !item.sub?.active
              const link = (
                <Link key={item.key} href={item.href} className={here ? 'on' : item.active ? 'half' : ''} aria-current={here ? 'page' : undefined}>
                  {item.label}
                </Link>
              )
              if (!item.sub) return link
              // 근태체크·영상등록: 마우스를 올리면(또는 키보드로 들어가면) 아래로 '통계' 드롭다운이 펼쳐진다
              return (
                <span key={item.key} className={`g-dd${item.active ? ' in' : ''}`}>
                  {link}
                  <span className="g-dd-menu" role="menu" aria-label={`${item.label} 하위 메뉴`}>
                    <Link href={item.sub.href} role="menuitem" className={item.sub.active ? 'on' : ''} aria-current={item.sub.active ? 'page' : undefined}>
                      <span className="g-dd-ico" aria-hidden="true">
                        📊
                      </span>
                      <span>
                        <b>{item.sub.label}</b>
                        <small>{item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}</small>
                      </span>
                    </Link>
                  </span>
                </span>
              )
            })}
          </nav>
          <div className="g-user">
            <span className="g-avatar" title={`${me.name} · ${roles}`}>
              {me.name.slice(0, 1) || '?'}
            </span>
            <span className="g-user-text">
              <strong>{me.name}</strong>
              <small>{roles}</small>
            </span>
            <ThemeToggle className="g-theme" />
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
