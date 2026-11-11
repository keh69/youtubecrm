'use client'

// 영상등록: 롱폼/숏폼 고르기(모든 스킨 공통, 필수). 안 고르고 [영상등록]을 누르면 경고가 뜨고 추가되지 않는다.
export function VideoTypePicker({ value, onChange, warn }: { value: '' | 'longform' | 'shortform'; onChange: (v: 'longform' | 'shortform') => void; warn?: boolean }) {
  return (
    <div className="xs-type-field">
      <span className="xs-type-label">형식 *</span>
      <div className={`xs-seg${warn ? ' xs-warn' : ''}`} role="radiogroup" aria-label="롱폼 또는 숏폼">
        {(
          [
            ['longform', '롱폼'],
            ['shortform', '숏폼']
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
            {value === k ? '☑' : '☐'} {label}
          </button>
        ))}
      </div>
    </div>
  )
}
