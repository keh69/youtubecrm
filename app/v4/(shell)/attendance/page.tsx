'use client'

import { useState } from 'react'
import { useMenuGuard, useMyAttendance, useNow } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTimeSec, fmtYmdShort, statusLabel, statusTone } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead, Sticker, type MsgState } from '../../_components/ui'
import { AttendanceSummary } from '@/components/attendance-extra'

export default function V4Attendance() {
  const allowed = useMenuGuard('attendance')
  const att = useMyAttendance()
  const now = useNow(1000)
  const [msg, setMsg] = useState<MsgState>(null)
  if (!allowed) return null

  const press = async (kind: 'in' | 'out') => {
    const res = kind === 'in' ? await att.checkIn() : await att.checkOut()
    if (res.ok) setMsg({ tone: 'ok', text: kind === 'in' ? '출근이 기록되었습니다.' : '퇴근이 기록되었습니다.' })
    else if (res.error) setMsg({ tone: 'error', text: res.error })
  }

  const t = att.today
  const clock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
  const blocked = att.loading || att.busy !== null
  // 폰·태블릿: 버튼은 꺼진 모양이지만 누를 수 있게 두고, 누르면 훅이 'PC에서만' 안내 창을 띄운다
  const offCls = att.mobileBlocked ? ' att-mobile-off' : ''

  return (
    <>
      <PageHead
        title="근태체크"
        tag="출근 도장"
        desc="출근할 때와 퇴근할 때 버튼을 한 번씩 눌러 주세요. 퇴근을 안 누르면 23:59에 자동 퇴근됩니다."
      />

      {att.error && <Msg tone="error">{att.error}</Msg>}

      <section className="att-clock blk bg-blue">
        <div className="att-clock-label">{att.data ? fmtYmdShort(att.data.today) : ''} 현재 시각</div>
        <div className="att-clock-time">{clock}</div>
        <AttendanceSummary record={att.today} />
        <div className="att-clock-sticker">
          <Sticker tone={statusTone(t)} big>
            {statusLabel(t)}
          </Sticker>
        </div>
      </section>

      <section className="att-times">
        <div className="blk bg-yellow att-time">
          <span>출근 누른 시간</span>
          <strong>{fmtTimeSec(t?.checkInAt)}</strong>
        </div>
        <div className="blk bg-yellow att-time">
          <span>퇴근 누른 시간</span>
          <strong>{fmtTimeSec(t?.checkOutAt)}</strong>
        </div>
        <div className="blk bg-white att-time">
          <span>근무 시간</span>
          <strong>{t?.checkInAt ? fmtMinutes(t.workedMinutes) : '-'}</strong>
        </div>
      </section>

      {t?.status === 'absent' && <Msg tone="error">오늘은 결근으로 처리되어 있습니다. 사유: {t.absenceReason || '-'}</Msg>}

      <section className="att-btns">
        <button className={`giant mint${offCls}`} aria-disabled={att.mobileBlocked || undefined} disabled={!att.mobileBlocked && (blocked || !att.canCheckIn)} onClick={() => press('in')}>
          <span className="giant-main">{att.busy === 'in' ? '기록 중…' : '출근'}</span>
          <span className="giant-sub">{t?.checkInAt ? `${fmtTimeSec(t.checkInAt)} 기록됨` : 'IN · 지금 누르기'}</span>
        </button>
        <button className={`giant pink${offCls}`} aria-disabled={att.mobileBlocked || undefined} disabled={!att.mobileBlocked && (blocked || !att.canCheckOut)} onClick={() => press('out')}>
          <span className="giant-main">{att.busy === 'out' ? '기록 중…' : '퇴근'}</span>
          <span className="giant-sub">{t?.checkOutAt ? `${fmtTimeSec(t.checkOutAt)} 기록됨` : 'OUT · 지금 누르기'}</span>
        </button>
      </section>
      {msg && (
        <Msg tone={msg.tone} live="status">
          {msg.text}
        </Msg>
      )}

      <section className="blk">
        <BlockTitle color="mint">최근 30일 기록</BlockTitle>
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
                    <td className="strong">{fmtYmdShort(d.workDate)}</td>
                    <td className="num">{fmtTimeSec(d.checkInAt)}</td>
                    <td className="num">
                      {d.autoCheckout ? <span className="xs-mini-unresolved">미처리</span> : d.checkOutAt ? fmtTimeSec(d.checkOutAt) : d.workDate === att.data?.today ? '' : '-'}
                    </td>
                    <td className="num">{d.checkInAt ? fmtMinutes(d.workedMinutes) : '-'}</td>
                    <td>
                      <Sticker tone={statusTone(d)}>{statusLabel(d)}</Sticker>
                      {d.status === 'absent' && d.absenceReason && <span className="reason">{d.absenceReason}</span>}
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
