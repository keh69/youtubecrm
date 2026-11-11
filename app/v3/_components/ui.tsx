'use client'

// v3 전용 작은 조각들 (다른 버전에서 쓰지 않는다).

import { statusLabel, statusTone } from '@/lib/crm/client/format'

export type Msg = { tone: 'ok' | 'error'; text: string } | null

type RecordLike = { status: string; checkInAt: string | null; checkOutAt: string | null } | null | undefined

// 상태 도장: 작은 테두리 글자
export function Stamp({ record }: { record: RecordLike }) {
  return <span className={`j-stamp tone-${statusTone(record)}`}>{statusLabel(record)}</span>
}

export function Note({ msg, alert }: { msg: Msg; alert?: boolean }) {
  if (!msg) return null
  return (
    <p className={`j-note ${msg.tone}`} role={alert ? 'alert' : 'status'}>
      {msg.text}
    </p>
  )
}

// 기사 머리: 작은 꼭지(kicker) + 제목 + 리드 문단
export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="j-head">
      <span className="j-kicker">{kicker}</span>
      <h1>{title}</h1>
      {children && <p className="j-lede">{children}</p>}
    </header>
  )
}

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return <p className="j-loading">{text}</p>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="j-empty">{children}</p>
}
