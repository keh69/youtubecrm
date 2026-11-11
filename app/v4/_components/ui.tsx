'use client'

// v4 전용 작은 화면 조각들 (Bold Block)

export type Tone = 'ok' | 'error'
export type MsgState = { tone: Tone; text: string } | null

export function PageHead({ title, desc, tag }: { title: string; desc: string; tag?: string }) {
  return (
    <header className="phead">
      <h1>
        <span className="phead-title">{title}</span>
        {tag && <span className="phead-tag">{tag}</span>}
      </h1>
      <p>{desc}</p>
    </header>
  )
}

export function Msg({ tone, children, live }: { tone: Tone; children: React.ReactNode; live?: 'status' | 'alert' }) {
  return (
    <p className={`msg msg-${tone}`} role={live}>
      <span className="msg-ico" aria-hidden="true">
        {tone === 'ok' ? '✓' : '!'}
      </span>
      <span>{children}</span>
    </p>
  )
}

// 근태 상태: 비스듬히 붙인 스티커 모양
export function Sticker({ tone, children, big }: { tone: string; children: React.ReactNode; big?: boolean }) {
  return <span className={`sticker tone-${tone}${big ? ' big' : ''}`}>{children}</span>
}

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return (
    <p className="loading">
      <span className="loading-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {text}
    </p>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>
}

export function BlockTitle({ children, color = 'yellow', right }: { children: React.ReactNode; color?: 'yellow' | 'pink' | 'blue' | 'mint'; right?: React.ReactNode }) {
  return (
    <div className="blk-head">
      <h2 className={`blk-title bg-${color}`}>{children}</h2>
      {right && <div className="blk-head-right">{right}</div>}
    </div>
  )
}
