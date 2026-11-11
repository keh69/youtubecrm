'use client'

import { useRef } from 'react'

// 날짜 입력칸(모든 스킨 공통): 1987.05.27 처럼 바로 타이핑할 수 있고(숫자만 쳐도 점이 자동으로 들어간다),
// 오른쪽 📅 버튼을 누르면 달력이 뜬다. 달력에서 고르면 칸에 채워지고 커서가 바로 칸으로 돌아온다.
// 값은 화면에 보이는 그대로(YYYY.MM.DD) 주고받는다. 서버로 보낼 때는 dottedToIso 로 바꾼다.

export function isoToDotted(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10).replace(/-/g, '.') : ''
}

// '' → '' / 올바른 날짜 → 'YYYY-MM-DD' / 덜 쓰거나 없는 날짜 → null
export function dottedToIso(text: string): string | null {
  const t = text.trim()
  if (!t) return ''
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(t)
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}

function formatTyping(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 4) return d
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`
}

export function DateInput({
  value,
  onChange,
  className,
  autoFocus,
  ariaLabel = '날짜',
  placeholder = '2026.11.11'
}: {
  value: string
  onChange: (dotted: string) => void
  className?: string
  autoFocus?: boolean
  ariaLabel?: string
  placeholder?: string
}) {
  const text = useRef<HTMLInputElement>(null)

  // 📅 자리에는 진짜 날짜 칸(type=date)을 투명하게 겹쳐 둔다. 누르는 순간 브라우저가 직접 달력을 연다.
  // (숨긴 칸에 showPicker 만 부르던 예전 방식은 일부 브라우저에서 달력이 뜨지 않았다)
  const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
    const p = e.currentTarget
    try {
      p.showPicker()
    } catch {
      /* 이미 열렸거나 지원하지 않는 브라우저: 브라우저 기본 동작에 맡긴다 */
    }
  }

  return (
    <span className="date-input">
      <input
        ref={text}
        className={className}
        value={value}
        onChange={(e) => onChange(formatTyping(e.target.value))}
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={10}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
      />
      <span className="date-input-cal" title="달력에서 고르기">
        <span className="date-input-ico" aria-hidden="true">
          📅
        </span>
        <input
          type="date"
          className="date-input-picker"
          aria-label={`${ariaLabel} 달력에서 고르기`}
          min="1950-01-01"
          value={dottedToIso(value) || ''}
          onClick={openPicker}
          onChange={(e) => {
            if (!e.target.value) return
            onChange(isoToDotted(e.target.value))
            // 고른 뒤 바로 칸에 커서를 둔다(이어서 고칠 수 있게)
            window.setTimeout(() => {
              const el = text.current
              if (el) {
                el.focus()
                el.setSelectionRange(el.value.length, el.value.length)
              }
            }, 0)
          }}
        />
      </span>
    </span>
  )
}
