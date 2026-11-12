'use client'

import { useState } from 'react'
import { useMenuGuard, useMyAttendance, useNow } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTimeSec, fmtYmdShort, statusLabel, statusTone } from '@/lib/crm/client/format'
import { AttendanceSummary } from '@/components/attendance-extra'

export default function V1Attendance() {
  const allowed = useMenuGuard('attendance')
  const att = useMyAttendance()
  const now = useNow(1000)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  if (!allowed) return null

  const press = async (kind: 'in' | 'out') => {
    const res = kind === 'in' ? await att.checkIn() : await att.checkOut()
    if (res.ok) setMsg({ tone: 'ok', text: kind === 'in' ? '출근이 기록되었습니다.' : '퇴근이 기록되었습니다.' })
    else if (res.error) setMsg({ tone: 'error', text: res.error })
  }

  const t = att.today
  const clock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)

  return (
    <>
      <div className="page-head">
        <h1>근태체크</h1>
        <p className="muted">출근할 때와 퇴근할 때 버튼을 한 번씩 눌러 주세요. 퇴근을 안 누르면 23:59에 자동 퇴근됩니다.</p>
      </div>

      {att.error && <p className="msg error">{att.error}</p>}

      <section className="card att-card">
        <div className="att-clock">
          <span className="muted small">{att.data ? fmtYmdShort(att.data.today) : ''} 현재 시각</span>
          <strong>{clock}</strong>
          <AttendanceSummary record={att.today} />
          <span className={`badge tone-${statusTone(t)}`}>{statusLabel(t)}</span>
        </div>
        <div className="att-times">
          <div>
            <span className="muted small">출근 누른 시간</span>
            <strong>{fmtTimeSec(t?.checkInAt)}</strong>
          </div>
          <div>
            <span className="muted small">퇴근 누른 시간</span>
            <strong>{fmtTimeSec(t?.checkOutAt)}</strong>
          </div>
          <div>
            <span className="muted small">근무 시간</span>
            <strong>{t?.checkInAt ? fmtMinutes(t.workedMinutes) : '-'}</strong>
          </div>
        </div>
        {t?.status === 'absent' && (
          <p className="msg error">오늘은 결근으로 처리되어 있습니다. 사유: {t.absenceReason || '-'}</p>
        )}
        <div className="att-buttons">
          {/* 폰·태블릿: 꺼진 모양이지만 누르면 'PC에서만 근태체크가 가능합니다' 안내 창 */}
          <button className={`btn primary big${att.mobileBlocked ? ' att-mobile-off' : ''}`} aria-disabled={att.mobileBlocked || undefined} disabled={!att.mobileBlocked && (att.loading || !att.canCheckIn || att.busy !== null)} onClick={() => press('in')}>
            {att.busy === 'in' ? '기록 중…' : '출근'}
          </button>
          <button className={`btn dark big${att.mobileBlocked ? ' att-mobile-off' : ''}`} aria-disabled={att.mobileBlocked || undefined} disabled={!att.mobileBlocked && (att.loading || !att.canCheckOut || att.busy !== null)} onClick={() => press('out')}>
            {att.busy === 'out' ? '기록 중…' : '퇴근'}
          </button>
        </div>
        {msg && <p className={`msg ${msg.tone}`} role="status">{msg.text}</p>}
      </section>

      <section className="card">
        <h2>최근 30일 기록</h2>
        {att.loading ? (
          <p className="muted">불러오는 중…</p>
        ) : !att.data?.history.length ? (
          <p className="empty">아직 기록이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>출근</th>
                  <th>퇴근</th>
                  <th>근무 시간</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {att.data.history.map((d) => (
                  <tr key={d.workDate}>
                    <td>{fmtYmdShort(d.workDate)}</td>
                    <td className="num">{fmtTimeSec(d.checkInAt)}</td>
                    <td className="num">
                      {d.autoCheckout ? <span className="xs-mini-unresolved">미처리</span> : d.checkOutAt ? fmtTimeSec(d.checkOutAt) : d.workDate === att.data?.today ? '' : '-'}
                    </td>
                    <td className="num">{d.checkInAt ? fmtMinutes(d.workedMinutes) : '-'}</td>
                    <td>
                      <span className={`badge tone-${statusTone(d)}`}>{statusLabel(d)}</span>
                      {d.status === 'absent' && d.absenceReason && <span className="muted small"> {d.absenceReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
