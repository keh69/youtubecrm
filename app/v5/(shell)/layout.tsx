'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, SETTINGS_TAB_EVENT, useNav, useSession, useUnresolvedCount } from '@/lib/crm/client/hooks'
import { ThemeToggle } from '@/lib/crm/client/theme'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  // 통계 드롭다운을 누르면 닫아 둘 메뉴(마우스가 그 메뉴 밖으로 나가면 풀린다)
  const [closedKey, setClosedKey] = useState<string | null>(null)
  const roles = me.roles.map((r) => r.name).join(', ') || '역할 없음'
  // 설정 > 07 미처리 권한이 있으면 미처리가 남아 있는 동안 상단에 알림이 늘 떠 있다
  const unresolved = useUnresolvedCount((me.settingsTabs || []).includes('unresolved'))
  const pending = unresolved ? unresolved.checkIn + unresolved.checkOut : 0
  return (
    <div className={`g-app${pending ? ' has-alert' : ''}`}>
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
              const here = item.active && !item.subs?.some((x) => x.active)
              const link = (
                <Link key={item.key} href={item.href} className={here ? 'on' : item.active ? 'half' : ''} aria-current={here ? 'page' : undefined}>
                  {item.label}
                </Link>
              )
              if (!item.sub) return link
              // 근태체크·영상등록: 마우스를 올리면(또는 키보드로 들어가면) 아래로 '통계' 드롭다운이 펼쳐진다
              return (
                <span
                  key={item.key}
                  className={`g-dd${item.active ? ' in' : ''}${closedKey === item.key ? ' closed' : ''}`}
                  onMouseLeave={() => setClosedKey((k) => (k === item.key ? null : k))}
                  onClick={(e) => {
                    // 근태체크·영상등록이나 통계를 누르면 드롭다운을 닫는다(포커스도 풀어서 다시 열리지 않게)
                    if ((e.target as HTMLElement).closest('a')) {
                      setClosedKey(item.key)
                      ;(document.activeElement as HTMLElement | null)?.blur()
                    }
                  }}
                >
                  {link}
                  <span className="g-dd-menu" role="menu" aria-label={`${item.label} 하위 메뉴`}>
                    {(item.subs || [item.sub]).map((sub) => (
                      <Link key={sub.key} href={sub.href} role="menuitem" className={sub.active ? 'on' : ''} aria-current={sub.active ? 'page' : undefined}>
                        <span className="g-dd-ico" aria-hidden="true">
                          {sub.key === 'stats_compare' ? '📈' : '📊'}
                        </span>
                        <span>
                          <b>{sub.label}</b>
                          <small>{sub.key === 'stats_compare' ? '기간·직원 비교 차트' : item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}</small>
                        </span>
                      </Link>
                    ))}
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
      {pending > 0 && (
        <div className="g-alert-pop" role="alert">
          <span className="g-alert-dot" aria-hidden="true" />
          <span>
            <b>근태 미처리 {pending}건</b>
            <small>
              출근미처리 {unresolved!.checkIn}건 · 퇴근미처리 {unresolved!.checkOut}건
            </small>
          </span>
          <Link href="/v5/settings?tab=unresolved" className="g-btn primary sm" onClick={() => window.dispatchEvent(new CustomEvent(SETTINGS_TAB_EVENT, { detail: 'unresolved' }))}>
            처리하러 가기
          </Link>
        </div>
      )}
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
