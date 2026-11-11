import { statusLabel, statusTone } from '@/lib/crm/client/format'

export type Msg = { tone: 'ok' | 'error'; text: string } | null

type Rec = { status: string; checkInAt: string | null; checkOutAt: string | null } | null | undefined

export function PageHead({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="g-head">
      <span className="g-head-icon" aria-hidden="true">
        {emoji}
      </span>
      <div>
        <h1>{title}</h1>
        <p className="g-muted">{desc}</p>
      </div>
    </div>
  )
}

export function StatusPill({ record }: { record: Rec }) {
  return <span className={`g-pill tone-${statusTone(record)}`}>{statusLabel(record)}</span>
}

export function Note({ msg, role }: { msg: Msg; role?: 'status' | 'alert' }) {
  if (!msg) return null
  return (
    <p className={`g-msg ${msg.tone}`} role={role || 'status'}>
      {msg.text}
    </p>
  )
}

export function Loading() {
  return (
    <p className="g-loading">
      <span className="g-spinner" aria-hidden="true" />
      불러오는 중…
    </p>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="g-empty">{children}</p>
}
