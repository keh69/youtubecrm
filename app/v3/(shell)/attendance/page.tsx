'use client'

import { useState } from 'react'
import { useMenuGuard, useMyAttendance, useNow } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTimeSec, fmtYmdShort } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, Stamp, type Msg } from '../../_components/ui'
import { AttendanceSummary } from '@/components/attendance-extra'

export default function V3Attendance() {
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
  // 폰·태블릿: 버튼은 꺼진 모양이지만 누를 수 있게 두고, 누르면 훅이 'PC에서만' 안내 창을 띄운다
  const inDisabled = !att.mobileBlocked && (att.loading || !att.canCheckIn || att.busy !== null)
  const outDisabled = !att.mobileBlocked && (att.loading || !att.canCheckOut || att.busy !== null)
  const offCls = att.mobileBlocked ? ' att-mobile-off' : ''

  return (
    <>
      <PageHead kicker="오늘의 출석부" title="근태체크">
        출근할 때와 퇴근할 때 도장을 한 번씩 눌러 주세요. 퇴근을 안 누르면 23:59에 자동 퇴근됩니다.
      </PageHead>

      {att.error && <Note msg={{ tone: 'error', text: att.error }} />}

      <section className="j-section">
        <div className="j-clock">
          <span className="j-label">{att.data ? `${fmtYmdShort(att.data.today)} · ` : ''}현재 시각</span>
          <strong className="j-clock-time">{clock}</strong>
          <AttendanceSummary record={att.today} />
          <Stamp record={t} />
        </div>

        <div className="j-stamps">
          <div className="j-stamp-col">
            <button type="button" className={`j-stampbtn in${offCls}`} aria-disabled={att.mobileBlocked || undefined} disabled={inDisabled} onClick={() => press('in')}>
              <span className={att.busy === 'in' ? 'busy' : ''}>{att.busy === 'in' ? '기록 중…' : '출근'}</span>
            </button>
            <span className="j-label">출근 누른 시간</span>
            <strong className="j-written">{fmtTimeSec(t?.checkInAt)}</strong>
          </div>
          <div className="j-stamp-col">
            <button type="button" className={`j-stampbtn out${offCls}`} aria-disabled={att.mobileBlocked || undefined} disabled={outDisabled} onClick={() => press('out')}>
              <span className={att.busy === 'out' ? 'busy' : ''}>{att.busy === 'out' ? '기록 중…' : '퇴근'}</span>
            </button>
            <span className="j-label">퇴근 누른 시간</span>
            <strong className="j-written">{fmtTimeSec(t?.checkOutAt)}</strong>
          </div>
        </div>

        <p className="j-worked">
          <span className="j-label">오늘 근무 시간</span>
          <strong>{t?.checkInAt ? fmtMinutes(t.workedMinutes) : '-'}</strong>
        </p>

        {t?.status === 'absent' && <Note msg={{ tone: 'error', text: `오늘은 결근으로 처리되어 있습니다. 사유: ${t.absenceReason || '-'}` }} />}
        <Note msg={msg} />
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <h2 className="j-h2">최근 30일 기록</h2>
        {att.loading ? (
          <Loading />
        ) : !att.data?.history.length ? (
          <Empty>아직 기록이 없습니다.</Empty>
        ) : (
          <ol className="j-ledger">
            {att.data.history.map((d) => (
              <li key={d.workDate}>
                <span className="j-ledger-date">{fmtYmdShort(d.workDate)}</span>
                <span className="j-leader" aria-hidden="true" />
                <span className="j-ledger-vals">
                  <span>
                    <em>출근</em> {fmtTimeSec(d.checkInAt)}
                  </span>
                  <span>
                    <em>퇴근</em> {d.autoCheckout ? <span className="xs-mini-unresolved">미처리</span> : d.checkOutAt ? fmtTimeSec(d.checkOutAt) : d.workDate === att.data?.today ? '' : '-'}
                  </span>
                  <span>
                    <em>근무</em> {d.checkInAt ? fmtMinutes(d.workedMinutes) : '-'}
                  </span>
                </span>
                <span className="j-ledger-status">
                  <Stamp record={d} />
                  {d.status === 'absent' && d.absenceReason && <small className="j-reason">{d.absenceReason}</small>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
