'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useNow, useSession, type NavItem } from '@/lib/crm/client/hooks'

// 메뉴 → 탐색기 속 '파일' 모양(파일명·확장자·아이콘 색)
const FILES: Record<NavItem['key'], { name: string; ext: string; glyph: string }> = {
  attendance: { name: 'attendance.tsx', ext: 'tsx', glyph: '<>' },
  attendance_team: { name: 'team-attendance.tsx', ext: 'tsx', glyph: '<>' },
  videos: { name: 'videos.tsx', ext: 'tsx', glyph: '<>' },
  stats: { name: 'stats.sql', ext: 'sql', glyph: 'DB' },
  settings: { name: 'settings.json', ext: 'json', glyph: '{}' },
  skin: { name: 'skin.css', ext: 'css', glyph: '#' },
  me: { name: 'me.md', ext: 'md', glyph: 'M' }
}

function fileOf(item: NavItem) {
  return FILES[item.key] ?? { name: `${item.path.replace(/^\//, '')}.tsx`, ext: 'tsx', glyph: '<>' }
}

// [통계] 버튼이 여는 화면(직원근태·영상통계)의 파일 모양과 이름
function subFileOf(item: NavItem) {
  return item.sub ? FILES[item.sub.key] : null
}
function subTitleOf(item: NavItem) {
  return item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'
}

function FileIcon({ item, file }: { item?: NavItem; file?: { ext: string; glyph: string } }) {
  const f = file ?? (item ? fileOf(item) : { ext: 'tsx', glyph: '<>' })
  return (
    <span className={`ficon ext-${f.ext}`} aria-hidden="true">
      {f.glyph}
    </span>
  )
}

// 활동 막대 아이콘(단순 선 그림)
function Icon({ name }: { name: 'files' | 'palette' | 'user' | 'logout' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'files')
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z" />
        <path d="M14 3v4h4" />
        <path d="M9 21h9a2 2 0 0 0 2-2V9" />
      </svg>
    )
  if (name === 'palette')
    return (
      <svg {...common}>
        <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.7-1.3-.7-2.2 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
        <circle cx="7.5" cy="11" r="1" />
        <circle cx="10" cy="7" r="1" />
        <circle cx="15" cy="7.5" r="1" />
      </svg>
    )
  if (name === 'user')
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </svg>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, base, logout } = useSession()
  const nav = useNav()
  const now = useNow(1000)
  const [open, setOpen] = useState(false)
  const roles = me.roles.map((r) => r.name).join(', ') || '역할 없음'
  const current = nav.find((i) => i.active)
  // [통계] 화면(직원근태·영상통계)에 있으면 탭·경로·상태 막대에 그 화면의 파일을 띄운다
  const onSub = Boolean(current?.sub?.active)
  const currentFile = current ? (onSub ? subFileOf(current) : fileOf(current)) : null
  const currentLabel = current ? (onSub && current.sub?.key === 'attendance_team' ? '직원근태 > 근태통계' : onSub ? '영상통계' : current.label) : ''
  const clock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
  const meActive = current?.key === 'me'

  return (
    <div className="shell">
      <nav className="activity" aria-label="활동 막대">
        <span className="act on" title="탐색기">
          <Icon name="files" />
        </span>
        <span className="act-spacer" />
        <Link href={`${base}/me`} className={`act${meActive ? ' on' : ''}`} title="내정보" aria-label="내정보">
          <Icon name="user" />
        </Link>
        <button type="button" className="act" title="로그아웃" aria-label="로그아웃" onClick={logout}>
          <Icon name="logout" />
        </button>
      </nav>

      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="side-title">
          <span>탐색기</span>
          <span className="side-dots" aria-hidden="true">
            ···
          </span>
        </div>
        <div className="brand">
          <span className="caret" aria-hidden="true">
            ▾
          </span>
          <img src="/logo-ant.png" alt="" width={18} height={18} />
          <div>
            <strong>여왕개미미디어</strong>
            <span>crm-web</span>
          </div>
        </div>
        <span className="side-label">
          <span className="caret" aria-hidden="true">
            ▾
          </span>
          src / 메뉴
        </span>
        <nav className="side-nav" aria-label="메뉴">
          {nav.map((item) => {
            const self = item.active && !item.sub?.active
            const subFile = subFileOf(item)
            return (
              <div key={item.key} className={`nav-row${item.active ? ' on' : ''}`}>
                <Link href={item.href} className={self ? 'active' : item.active ? 'parent' : ''} aria-current={self ? 'page' : undefined} onClick={() => setOpen(false)}>
                  <FileIcon item={item} />
                  <span className="fname">
                    <span className="fname-ko">{item.label}</span>
                    <span className="fname-en">{fileOf(item).name}</span>
                  </span>
                </Link>
                {item.sub && (
                  <Link
                    href={item.sub.href}
                    className={`nav-sub${item.sub.active ? ' on' : ''}`}
                    aria-current={item.sub.active ? 'page' : undefined}
                    title={subTitleOf(item)}
                    onClick={() => setOpen(false)}
                  >
                    {subFile && <FileIcon file={subFile} />}
                    {item.sub.label}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>
        <div className="side-user">
          <span className="side-label">
            <span className="caret" aria-hidden="true">
              ▾
            </span>
            계정
          </span>
          <div className="side-user-info">
            <strong>{me.name}</strong>
            <span>{roles}</span>
          </div>
          <button className="btn ghost small" onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbars">
          <header className="mobile-top">
            <button className="btn ghost small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              ☰ 탐색기
            </button>
            <strong>여왕개미미디어 CRM</strong>
          </header>
          <div className="statusbar" role="status" aria-live="off">
            <span className="sb-item">
              <span className="sb-dot" aria-hidden="true">
                ●
              </span>{' '}
              로그인: <b>{me.name}</b>
            </span>
            <span className="sb-sep">·</span>
            <span className="sb-item sb-roles">{roles}</span>
            <span className="sb-sep">·</span>
            <span className="sb-item sb-clock">KST {clock}</span>
            {currentFile && <span className="sb-item sb-file">{currentFile.name} · UTF-8 · LF</span>}
          </div>
          <div className="tabbar" role="tablist" aria-label="열린 화면">
            {current && currentFile ? (
              <span className="etab on" role="tab" aria-selected="true">
                <FileIcon file={currentFile} />
                <span className="etab-name">{currentFile.name}</span>
                <span className="etab-ko">{currentLabel}</span>
                <span className="etab-x" aria-hidden="true">
                  ×
                </span>
              </span>
            ) : (
              <span className="etab on" role="tab" aria-selected="true">
                <span className="etab-name">untitled</span>
              </span>
            )}
          </div>
          {current && currentFile && (
            <div className="crumbs">
              crm-web <span>›</span> src <span>›</span> <FileIcon file={currentFile} /> {currentFile.name}
            </div>
          )}
        </div>
        {open && <div className="side-dim" onClick={() => setOpen(false)} />}
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export default function V10ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="/v10" loading={<div className="boot">불러오는 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
