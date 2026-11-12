'use client'

import { useState } from 'react'
import { useMenuGuard, useMyAttendance, useNow } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTimeSec, fmtYmdShort, statusTone } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, Panel, StatusTag, type Msg } from '../../_components/ui'
import { AttendanceSummary } from '@/components/attendance-extra'

export default function V2Attendance() {
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
  const tone = statusTone(t)

  return (
    <>
      <PageHead
        code="ATT-01"
        title="근태체크"
        desc="출근할 때와 퇴근할 때 버튼을 한 번씩 눌러 주세요. 퇴근을 안 누르면 23:59에 자동 퇴근됩니다."
      />

      {att.error && <Note msg={{ tone: 'error', text: att.error }} />}

      <section className={`console tone-${tone}`}>
        <div className="console-clock">
          <div className="sect">
            {att.data ? fmtYmdShort(att.data.today) : ''} 현재 시각 · KST
          </div>
          <div className="clock mono" aria-live="off">
            {clock}
          </div>
          <AttendanceSummary record={att.today} />
          <div className="console-state">
            <span className="sect">오늘 상태</span>
            <StatusTag record={t} />
          </div>
        </div>

        <div className="readouts">
          <div className="readout">
            <span className="sect">출근 누른 시간</span>
            <strong className="mono">{fmtTimeSec(t?.checkInAt)}</strong>
          </div>
          <div className="readout">
            <span className="sect">퇴근 누른 시간</span>
            <strong className="mono">{fmtTimeSec(t?.checkOutAt)}</strong>
          </div>
          <div className="readout">
            <span className="sect">근무 시간</span>
            <strong className="mono">{t?.checkInAt ? fmtMinutes(t.workedMinutes) : '-'}</strong>
          </div>
        </div>

        {t?.status === 'absent' && <Note msg={{ tone: 'error', text: `오늘은 결근으로 처리되어 있습니다. 사유: ${t.absenceReason || '-'}` }} />}

        <div className="keys">
          {/* 폰·태블릿: 꺼진 모양이지만 누르면 'PC에서만 근태체크가 가능합니다' 안내 창 */}
          <button className={`key big go${att.mobileBlocked ? ' att-mobile-off' : ''}`} aria-disabled={att.mobileBlocked || undefined} disabled={!att.mobileBlocked && (att.loading || !att.canCheckIn || att.busy !== null)} onClick={() => press('in')}>
            {att.busy === 'in' ? '기록 중…' : '▶ 출근'}
          </button>
          <button className={`key big stop${att.mobileBlocked ? ' att-mobile-off' : ''}`} aria-disabled={att.mobileBlocked || undefined} disabled={!att.mobileBlocked && (att.loading || !att.canCheckOut || att.busy !== null)} onClick={() => press('out')}>
            {att.busy === 'out' ? '기록 중…' : '■ 퇴근'}
          </button>
        </div>
        <Note msg={msg} />
      </section>

      <Panel label="최근 30일 기록">
        {att.loading ? (
          <Loading />
        ) : !att.data?.history.length ? (
          <Empty>아직 기록이 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
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
                    <td className="mono">{fmtYmdShort(d.workDate)}</td>
                    <td className="mono">{fmtTimeSec(d.checkInAt)}</td>
                    <td className="mono">
                      {d.autoCheckout ? <span className="xs-mini-unresolved">미처리</span> : d.checkOutAt ? fmtTimeSec(d.checkOutAt) : d.workDate === att.data?.today ? '' : '-'}
                    </td>
                    <td className="mono">{d.checkInAt ? fmtMinutes(d.workedMinutes) : '-'}</td>
                    <td>
                      <StatusTag record={d} />
                      {d.status === 'absent' && d.absenceReason && <span className="muted small"> {d.absenceReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
