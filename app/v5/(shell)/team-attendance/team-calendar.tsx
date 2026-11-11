'use client'

import { useState } from 'react'
import { addDays, fmtTime, todayKst } from '@/lib/crm/client/format'
import type { TeamAttendance } from '@/lib/crm/client/types'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function lastDayOfMonth(ymd: string) {
  const [y, m] = ymd.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${ymd.slice(0, 7)}-${String(d).padStart(2, '0')}`
}
const dow = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay()

// 근태통계 맨 아래 달력: 고른 직원의 날짜별 출근(지각)·퇴근(야근/미처리)과 시간
export function TeamCalendar({ data }: { data: TeamAttendance }) {
  const [userId, setUserId] = useState('')
  const row = data.rows.find((r) => r.user.id === userId) || data.rows[0]
  if (!row) return null

  const start = data.from
  const end = data.period === 'week' ? addDays(start, 6) : lastDayOfMonth(start)
  const cells: Array<string | null> = []
  for (let i = 0; i < dow(start); i++) cells.push(null)
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const today = todayKst()

  return (
    <section className="g-glass">
      <div className="g-dump-head">
        <h2 className="g-h2">달력 · {data.label}</h2>
        <label className="g-field g-cal-who">
          <span className="sr-only">직원</span>
          <select className="g-input sm" value={row.user.id} onChange={(e) => setUserId(e.target.value)} aria-label="달력에서 볼 직원">
            {data.rows.map((r) => (
              <option key={r.user.id} value={r.user.id}>
                {r.user.name} ({r.user.loginId})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="g-cal" role="grid" aria-label={`${row.user.name} 근태 달력`}>
        {WEEK.map((w, i) => (
          <div key={w} className={`g-cal-head${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`} role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="g-cal-cell empty" />
          const r = row.records[d]
          const future = d > today
          const wd = dow(d)
          return (
            <div key={d} className={`g-cal-cell${d === today ? ' today' : ''}${future ? ' future' : ''}${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}`} role="gridcell">
              <span className="g-cal-day">{Number(d.slice(8))}</span>
              {r?.status === 'absent' ? (
                <span className="g-cal-line absent" title={r.absenceReason || ''}>
                  결근{r.absenceReason ? ` · ${r.absenceReason}` : ''}
                </span>
              ) : r?.status === 'vacation' ? (
                <span className="g-cal-line off">휴무</span>
              ) : (
                <>
                  {r?.checkInAt && (
                    <span className="g-cal-line in">
                      출근 <b>{fmtTime(r.checkInAt)}</b>
                      {r.late && <i className="g-cal-tag late">지각</i>}
                    </span>
                  )}
                  {r?.checkOutAt && (
                    <span className="g-cal-line out">
                      {r.autoCheckout ? (
                        <i className="g-cal-tag unresolved">퇴근(미처리)</i>
                      ) : (
                        <>
                          퇴근 <b>{fmtTime(r.checkOutAt)}</b>
                          {r.overtime && <i className="g-cal-tag overtime">야근</i>}
                        </>
                      )}
                    </span>
                  )}
                  {r?.checkInAt && !r.checkOutAt && d === today && <span className="g-cal-line working">근무 중</span>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
