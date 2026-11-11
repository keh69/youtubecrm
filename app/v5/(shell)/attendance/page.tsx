'use client'

import { useState } from 'react'
import { useMenuGuard, useMyAttendance, useNow } from '@/lib/crm/client/hooks'
import { fmtHourMin, fmtTimeSec, fmtYmdShort, liveWorkedMinutes, statusLabel, statusTone } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, StatusPill, type Msg } from '../../_components/ui'

const GOAL_MINUTES = 9 * 60

function Ring({ minutes, active, tone, children }: { minutes: number; active: boolean; tone: string; children: React.ReactNode }) {
  const r = 92
  const c = 2 * Math.PI * r
  const ratio = active ? Math.min(1, Math.max(0, minutes / GOAL_MINUTES)) : 0
  return (
    <div className={`g-ring tone-${tone}`}>
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <defs>
          <linearGradient id="g-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a48bff" />
            <stop offset="100%" stopColor="#7c5cff" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r={r} className="g-ring-track" />
        {ratio > 0 && (
          <circle cx="110" cy="110" r={r} className="g-ring-fill" strokeDasharray={`${c * ratio} ${c}`} transform="rotate(-90 110 110)" />
        )}
      </svg>
      <div className="g-ring-center">{children}</div>
    </div>
  )
}

export default function V5Attendance() {
  const allowed = useMenuGuard('attendance')
  const att = useMyAttendance()
  const now = useNow(1000)
  const [msg, setMsg] = useState<Msg>(null)
  if (!allowed) return null

  const press = async (kind: 'in' | 'out') => {
    const res = kind === 'in' ? await att.checkIn() : await att.checkOut()
    if (res.ok) setMsg({ tone: 'ok', text: kind === 'in' ? '출근이 기록되었습니다.' : '퇴근이 기록되었습니다.' })
    else if (res.error) setMsg({ tone: 'error', text: res.error })
  }

  const t = att.today
  const clock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
  const worked = liveWorkedMinutes(t, now)
  const pct = Math.min(100, Math.round((worked / GOAL_MINUTES) * 100))

  return (
    <>
      <PageHead emoji="⏰" title="근태체크" desc="출근할 때와 퇴근할 때 버튼을 한 번씩 눌러 주세요. 퇴근을 안 누르면 23:59에 자동 퇴근됩니다." />

      {att.error && <Note msg={{ tone: 'error', text: att.error }} role="alert" />}

      <section className="g-glass g-att">
        <div className="g-att-clock">
          <span className="g-muted g-small">{att.data ? fmtYmdShort(att.data.today) : ''} 현재 시각</span>
          <strong>{clock}</strong>
        </div>

        <dl className={`g-att-summary tone-${statusTone(t)}`}>
          <div>
            <dt>현재상태</dt>
            <dd>{statusLabel(t)}</dd>
          </div>
          <div>
            <dt>총 근무시간</dt>
            <dd>{fmtHourMin(worked)}</dd>
          </div>
        </dl>

        <Ring minutes={worked} active={Boolean(t?.checkInAt)} tone={statusTone(t)}>
          <StatusPill record={t} />
          <strong className="g-ring-value">{t?.checkInAt ? fmtHourMin(worked) : '-'}</strong>
          <span className="g-muted g-small">근무 시간 · 9시간 중 {t?.checkInAt ? pct : 0}%</span>
        </Ring>

        <div className="g-att-buttons">
          <button className="g-round in" disabled={att.loading || !att.canCheckIn || att.busy !== null} onClick={() => press('in')}>
            <span aria-hidden="true">☀️</span>
            {att.busy === 'in' ? '기록 중…' : '출근'}
          </button>
          <button className="g-round out" disabled={att.loading || !att.canCheckOut || att.busy !== null} onClick={() => press('out')}>
            <span aria-hidden="true">🌙</span>
            {att.busy === 'out' ? '기록 중…' : '퇴근'}
          </button>
        </div>

        <div className="g-att-chips">
          <span className={`g-timechip ${t?.checkInAt ? 'set' : ''}`}>
            <small>출근 누른 시간</small>
            <b>{fmtTimeSec(t?.checkInAt)}</b>
          </span>
          <span className={`g-timechip ${t?.checkOutAt ? 'set' : ''}`}>
            <small>퇴근 누른 시간</small>
            <b>{fmtTimeSec(t?.checkOutAt)}</b>
          </span>
        </div>

        {t?.status === 'absent' && <Note msg={{ tone: 'error', text: `오늘은 결근으로 처리되어 있습니다. 사유: ${t.absenceReason || '-'}` }} />}
        <Note msg={msg} />
      </section>

      <section className="g-glass">
        <h2 className="g-h2">최근 30일 기록</h2>
        {att.loading ? (
          <Loading />
        ) : !att.data?.history.length ? (
          <Empty>아직 기록이 없습니다.</Empty>
        ) : (
          <ul className="g-history">
            {att.data.history.map((d) => {
              const [, mm, dd] = d.workDate.split('-')
              const wd = fmtYmdShort(d.workDate).split(' ')[1] || ''
              return (
                <li key={d.workDate} className={`tone-${statusTone(d)}`}>
                  <div className="g-daybadge" title={fmtYmdShort(d.workDate)}>
                    <small>{Number(mm)}월</small>
                    <b>{Number(dd)}</b>
                    <small>{wd.replace(/[()]/g, '')}</small>
                  </div>
                  <div className="g-history-times">
                    <span>
                      <small>출근</small> {fmtTimeSec(d.checkInAt)}
                    </span>
                    <span className="g-arrow" aria-hidden="true">
                      →
                    </span>
                    <span>
                      <small>퇴근</small> {fmtTimeSec(d.checkOutAt)}
                      {d.autoCheckout && <em className="g-muted g-small"> (자동)</em>}
                    </span>
                  </div>
                  <div className="g-history-side">
                    <span className="g-history-worked">{d.checkInAt ? fmtHourMin(d.workedMinutes) : '-'}</span>
                    <StatusPill record={d} />
                  </div>
                  {d.status === 'absent' && d.absenceReason && <p className="g-history-reason">사유: {d.absenceReason}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
