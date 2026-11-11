'use client'

import { statusLabel, statusTone } from '@/lib/crm/client/format'
import type { DayRecord } from '@/lib/crm/client/types'

// v2 전용 작은 화면 조각들

export type Msg = { tone: 'ok' | 'error'; text: string } | null

export function PageHead({ code, title, desc }: { code: string; title: string; desc: string }) {
  return (
    <header className="phead">
      <div className="phead-row">
        <span className="phead-code mono">{code}</span>
        <h1>{title}</h1>
      </div>
      <p className="muted">{desc}</p>
    </header>
  )
}

export function Panel({ label, right, children, className = '' }: { label: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2 className="sect">{label}</h2>
        {right && <div className="panel-tools">{right}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Note({ msg }: { msg: Msg }) {
  if (!msg) return null
  return (
    <p className={`note ${msg.tone === 'ok' ? 'good' : 'bad'}`} role="status">
      {msg.text}
    </p>
  )
}

export function StatusTag({ record }: { record: DayRecord | null | undefined }) {
  return <span className={`tag tone-${statusTone(record)}`}>{statusLabel(record)}</span>
}

export function Loading() {
  return <p className="loading mono">불러오는 중…</p>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>
}
