'use client'

import { useRef, useState } from 'react'
import { fmtNumber, fmtYmdShort } from '@/lib/crm/client/format'

// 디비입력 표: 직원(세로) × 날짜(가로). 칸을 눌러 숫자를 적고 Enter·칸 밖을 누르면 저장한다.
export type DbData = {
  month: string
  from: string
  to: string
  today: string
  ready: boolean
  hint: string | null
  people: Array<{ id: string; name: string; loginId: string; affiliationName: string | null }>
  counts: Array<{ userId: string; date: string; count: number }>
}

const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay()
const WD = ['일', '월', '화', '수', '목', '금', '토']

export function DbGrid({ data, onSave }: { data: DbData; onSave: (userId: string, date: string, count: number | null) => Promise<string | null> }) {
  const days = Array.from({ length: Number(data.to.slice(8)) }, (_, i) => `${data.month}-${String(i + 1).padStart(2, '0')}`)
  const value = new Map(data.counts.map((c) => [`${c.userId}|${c.date}`, c.count]))
  const [draft, setDraft] = useState<Record<string, string>>({}) // 적는 중인 칸
  const [state, setState] = useState<Record<string, 'saving' | 'ok' | 'err'>>({})
  const [msg, setMsg] = useState('')
  const box = useRef<HTMLTableElement>(null)

  const focusCell = (r: number, c: number) => {
    const el = box.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`)
    if (el && !el.disabled) {
      el.focus()
      el.select()
    }
  }
  const commit = async (userId: string, date: string) => {
    const key = `${userId}|${date}`
    if (!(key in draft)) return
    const raw = draft[key].trim()
    const before = value.get(key)
    const next = raw === '' ? null : Number(raw)
    setDraft((d) => {
      const { [key]: _, ...rest } = d
      return rest
    })
    if (next !== null && (!Number.isInteger(next) || next < 0)) return setMsg('0 이상의 정수만 적을 수 있습니다.')
    if ((before ?? null) === next) return
    setState((s) => ({ ...s, [key]: 'saving' }))
    const err = await onSave(userId, date, next)
    setState((s) => ({ ...s, [key]: err ? 'err' : 'ok' }))
    setMsg(err || '')
    if (!err) setTimeout(() => setState((s) => (s[key] === 'ok' ? (({ [key]: _, ...rest }) => rest)(s) : s)), 900)
  }

  const rowSum = (userId: string) => days.reduce((s, d) => s + (value.get(`${userId}|${d}`) || 0), 0)
  const daySum = (d: string) => data.people.reduce((s, p) => s + (value.get(`${p.id}|${d}`) || 0), 0)
  const total = data.people.reduce((s, p) => s + rowSum(p.id), 0)
  const passed = days.filter((d) => d <= data.today).length || 1 // 이번 달은 오늘까지 날 수

  return (
    <>
      <div className="g-table-wrap">
        <table className="g-table db-grid" ref={box}>
          <colgroup>
            <col className="c-name" />
            {days.map((d) => (
              <col key={d} />
            ))}
            <col className="c-sum" />
            <col className="c-avg" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">직원</th>
              {days.map((d) => {
                const w = weekday(d)
                return (
                  <th key={d} scope="col" className={`${w === 0 || w === 6 ? 'we' : ''}${d === data.today ? ' today' : ''}`} title={fmtYmdShort(d)}>
                    {Number(d.slice(8))}
                    <small>{WD[w]}</small>
                  </th>
                )
              })}
              <th scope="col" className="sum">
                합계
              </th>
              <th scope="col" className="sum" title="합계 ÷ 이 달에 지난 날 수(오늘까지)">
                일평균
              </th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((p, r) => (
              <tr key={p.id}>
                <th scope="row" title={`${p.name} (${p.loginId})${p.affiliationName ? ` · ${p.affiliationName}` : ''}`}>
                  {p.name}
                </th>
                {days.map((d, c) => {
                  const key = `${p.id}|${d}`
                  const saved = value.get(key)
                  const future = d > data.today
                  const shown = key in draft ? draft[key] : saved === undefined ? '' : String(saved)
                  return (
                    <td key={d} className={`${state[key] || ''}${future ? ' future' : ''}${saved ? ' has' : ''}`}>
                      <input
                        className="db-cell"
                        inputMode="numeric"
                        value={shown}
                        disabled={future || !data.ready}
                        data-r={r}
                        data-c={c}
                        aria-label={`${p.name} ${fmtYmdShort(d)} DB 개수`}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setDraft((x) => ({ ...x, [key]: e.target.value.replace(/[^\d]/g, '') }))}
                        onBlur={() => void commit(p.id, d)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            focusCell(r, c + 1)
                            if (document.activeElement === e.currentTarget) e.currentTarget.blur()
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            focusCell(r + 1, c)
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            focusCell(r - 1, c)
                          } else if (e.key === 'Escape') {
                            setDraft((x) => {
                              const { [key]: _, ...rest } = x
                              return rest
                            })
                            e.currentTarget.blur()
                          }
                        }}
                      />
                    </td>
                  )
                })}
                <td className="sum">{fmtNumber(rowSum(p.id))}</td>
                <td className="sum avg">{(rowSum(p.id) / passed).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">합계</th>
              {days.map((d) => {
                const s = daySum(d)
                return (
                  <td key={d} className={s ? undefined : 'zero'}>
                    {s ? fmtNumber(s) : '·'}
                  </td>
                )
              })}
              <td className="sum">{fmtNumber(total)}</td>
              <td className="sum avg">{(total / passed).toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {msg ? (
        <p className="g-msg error" role="alert">
          {msg}
        </p>
      ) : (
        <p className="g-muted g-small">일평균은 합계 ÷ 이 달에 지난 날 수(오늘까지)입니다. 오늘 이후 날짜는 적을 수 없습니다. 저장되면 칸이 잠깐 초록으로 깜빡입니다.</p>
      )}
    </>
  )
}
