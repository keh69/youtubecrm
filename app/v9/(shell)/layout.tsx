'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CrmSessionProvider, useNav, useSession } from '@/lib/crm/client/hooks'
import { Ico } from '../_ui'

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession()
  const nav = useNav()
  const [open, setOpen] = useState(false)
  const current = nav.find((n) => n.active)
  // [통계] 페이지(직원근태·영상통계)에 있으면 탭에는 부모 메뉴 대신 그 화면 이름을 띄운다
  const tab = current?.sub?.active
    ? { label: current.sub.key === 'attendance_team' ? '직원근태 > 근태통계' : '영상통계', key: current.sub.key }
    : current
      ? { label: current.label, key: current.key }
      : undefined
  const roleText = me.roles.map((r) => r.name).join(', ') || '역할 없음'
  return (
    <div className="shell">
      <header className="toolbar">
        <button className="tb-btn menu-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="객체 탐색기 열기">
          <Ico>☰</Ico>
        </button>
        <div className="app-title">
          <img src="/logo-ant.png" alt="" width={18} height={18} />
          <strong>여왕개미미디어 CRM</strong>
          <span className="ty">DB 관리 도구</span>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <div className="tb-group">
          <span className="conn">
            <span className="ok-dot" aria-hidden="true" />
            <span className="mono">{me.loginId}@crm_db</span>
          </span>
        </div>
        <div className="tb-right">
          <button className="tb-btn" onClick={() => window.location.reload()} title="새로고침">
            <Ico>⟳</Ico>
            <span className="tb-label">새로고침</span>
          </button>
          <button className="tb-btn" onClick={logout} title="연결 끊기(로그아웃)">
            <Ico>⏻</Ico>
            <span className="tb-label">로그아웃</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`side ${open ? 'open' : ''}`}>
          <div className="pane-head">
            <span>객체 탐색기</span>
            <span className="ty">Explorer</span>
          </div>
          <div className="tree">
            <div className="tree-node lv0">
              <span className="caret">▾</span>
              <span aria-hidden="true">🗄</span>
              <strong className="mono">crm_db</strong>
            </div>
            <div className="tree-node lv1">
              <span className="caret">▾</span>
              <span className="folder-ico" aria-hidden="true" />
              <span>테이블</span>
              <span className="ty">({nav.length})</span>
            </div>
            <nav className="side-nav" aria-label="메뉴">
              {nav.map((item) => {
                const self = item.active && !item.sub?.active
                return (
                  <div key={item.key} className={`nav-row${item.active ? ' on' : ''}`}>
                    <Link
                      href={item.href}
                      className={self ? 'active' : item.active ? 'parent' : ''}
                      aria-current={self ? 'page' : undefined}
                      title={item.description}
                      onClick={() => setOpen(false)}
                    >
                      <span className="tbl-ico" aria-hidden="true" />
                      <span className="nav-label">{item.label}</span>
                      <span className="nav-key">{item.key}</span>
                    </Link>
                    {item.sub && (
                      <Link
                        href={item.sub.href}
                        className={`nav-sub${item.sub.active ? ' on' : ''}`}
                        aria-current={item.sub.active ? 'page' : undefined}
                        title={item.key === 'attendance' ? '직원근태 · 근태통계' : '영상통계'}
                        onClick={() => setOpen(false)}
                      >
                        <span className="view-ico" aria-hidden="true" />
                        {item.sub.label}
                      </Link>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>
          <div className="side-user">
            <div className="pane-head sub">
              <span>세션</span>
              <span className="ty">Session</span>
            </div>
            <dl className="mini-props">
              <div>
                <dt>user</dt>
                <dd>{me.name}</dd>
              </div>
              <div>
                <dt>role</dt>
                <dd>{roleText}</dd>
              </div>
            </dl>
            <button className="btn ghost small block" onClick={logout}>
              <Ico>⏻</Ico> 로그아웃
            </button>
          </div>
        </aside>
        {open && <div className="side-dim" onClick={() => setOpen(false)} />}

        <div className="main">
          <div className="tabbar" role="presentation">
            {tab ? (
              <span className="doc-tab on">
                <span className="tbl-ico" aria-hidden="true" />
                <span>{tab.label}</span>
                <span className="mono ty">{tab.key}</span>
                <span className="tab-x" aria-hidden="true">
                  ×
                </span>
              </span>
            ) : (
              <span className="doc-tab on">
                <span>crm_db</span>
              </span>
            )}
          </div>
          <main className="content">{children}</main>
          <footer className="statusbar">
            <span>
              <span className="ok-dot" aria-hidden="true" /> 연결됨
            </span>
            <span className="mono">crm_db</span>
            <span className="sb-right">{me.name} · {roleText}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default function V9ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmSessionProvider base="/v9" loading={<div className="boot">crm_db 연결 중…</div>}>
      <Shell>{children}</Shell>
    </CrmSessionProvider>
  )
}
