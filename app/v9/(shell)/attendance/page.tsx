'use client'

import { useState } from 'react'
import { useMenuGuard, useMyAttendance, useNow } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTimeSec, fmtYmdShort, statusLabel, statusTone } from '@/lib/crm/client/format'
import { GridFoot, Ico, Props, RowNoTh, Th } from '../../_ui'

export default function V9Attendance() {
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
        <h2>오늘 기록</h2>
        <div className="att-split">
          <Props
            title="오늘"
            rows={[
              { k: '날짜', type: 'date', v: <span className="mono">{att.data ? fmtYmdShort(att.data.today) : '-'}</span> },
              { k: '현재 시각', type: 'time', v: <span className="mono clock">{clock}</span>, strong: true },
              { k: '상태', type: 'enum', v: <span className={`badge tone-${statusTone(t)}`}>{statusLabel(t)}</span> },
              { k: '출근 누른 시간', type: 'timestamp', v: <span className="mono">{fmtTimeSec(t?.checkInAt)}</span> },
              { k: '퇴근 누른 시간', type: 'timestamp', v: <span className="mono">{fmtTimeSec(t?.checkOutAt)}</span> },
              { k: '근무 시간', type: 'interval', v: <span className="mono">{t?.checkInAt ? fmtMinutes(t.workedMinutes) : '-'}</span> }
            ]}
          />
          <div className="att-actions">
            <div className="att-buttons">
              <button className="btn primary big" disabled={att.loading || !att.canCheckIn || att.busy !== null} onClick={() => press('in')}>
                <Ico>▶</Ico> {att.busy === 'in' ? '기록 중…' : '출근'}
              </button>
              <button className="btn dark big" disabled={att.loading || !att.canCheckOut || att.busy !== null} onClick={() => press('out')}>
                <Ico>■</Ico> {att.busy === 'out' ? '기록 중…' : '퇴근'}
              </button>
            </div>
            {t?.status === 'absent' && <p className="msg error">오늘은 결근으로 처리되어 있습니다. 사유: {t.absenceReason || '-'}</p>}
            {msg && (
              <p className={`msg ${msg.tone}`} role="status">
                {msg.text}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>최근 30일 기록</h2>
        {att.loading ? (
          <p className="muted">불러오는 중…</p>
        ) : !att.data?.history.length ? (
          <p className="empty">아직 기록이 없습니다.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <RowNoTh />
                    <Th name="날짜" type="date" />
                    <Th name="출근" type="time" />
                    <Th name="퇴근" type="time" />
                    <Th name="근무 시간" type="interval" />
                    <Th name="상태" type="enum" />
                  </tr>
                </thead>
                <tbody>
                  {att.data.history.map((d, i) => (
                    <tr key={d.workDate}>
                      <td className="rn">{i + 1}</td>
                      <td className="mono">{fmtYmdShort(d.workDate)}</td>
                      <td className="num">{fmtTimeSec(d.checkInAt)}</td>
                      <td className="num">
                        {fmtTimeSec(d.checkOutAt)}
                        {d.autoCheckout && <span className="muted small"> (자동)</span>}
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
            <GridFoot count={att.data.history.length} />
          </>
        )}
      </section>
    </>
  )
}
