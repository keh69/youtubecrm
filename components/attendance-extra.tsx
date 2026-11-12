'use client'

import { useEffect, useState } from 'react'
import { isMobileDevice } from '@/lib/crm/client/device'
import { useNow, useWorkTimes } from '@/lib/crm/client/hooks'
import { fmtHourMin, fmtYmdShort, liveWorkedMinutes, statusLabel } from '@/lib/crm/client/format'
import type { DayRecord } from '@/lib/crm/client/types'

// 근태체크 요약 줄(모든 스킨 공통): "현재상태 : 출근 · 총 근무시간 : n시간nn분"
export function AttendanceSummary({ record }: { record: DayRecord | null }) {
  const now = useNow(1000)
  const worked = liveWorkedMinutes(record, now)
  const [mobile, setMobile] = useState(false) // 폰·태블릿이면 출근·퇴근을 못 누른다는 안내
  useEffect(() => setMobile(isMobileDevice()), [])
  return (
    <>
    {mobile && <p className="xs-err" role="status">출근·퇴근은 컴퓨터에서만 누를 수 있습니다. 폰·태블릿에서는 기록만 볼 수 있어요.</p>}
    <dl className="xs-att-summary">
      <div>
        <dt>현재상태</dt>
        <dd>{statusLabel(record)}</dd>
      </div>
      <div>
        <dt>총 근무시간</dt>
        <dd>{fmtHourMin(worked)}</dd>
      </div>
    </dl>
    </>
  )
}

/* ───────── 근태통계 > 근태처리 버튼(모든 스킨 공통) ─────────
   출근 / 출근(지각) / 퇴근 / 퇴근(야근) 을 바로 적용한다. 이미 기록이 있으면 버튼이 꺼지고, 서버도 거절한다.
   시간을 비우면 오늘은 지금 시각, 지난 날은 기본 시간(출근 = 출근 기준시간 · 지각 = +30분 · 퇴근 = 퇴근 기준시간 · 야근 = +2시간, 설정 > 08 출퇴근시간). */
const APPLY_LABEL = { in: '출근', in_late: '출근(지각)', out: '퇴근', out_overtime: '퇴근(야근)' } as const
type ApplyAction = keyof typeof APPLY_LABEL
type TeamLike = {
  data: { rows: Array<{ user: { id: string }; records: Record<string, DayRecord> }> } | null
  applyDay: (userId: string, workDate: string, action: ApplyAction, time: string) => Promise<{ ok: boolean; error?: string }>
}

export function AttendanceApplyButtons({ team, userId, workDate, time, btnClass }: { team: TeamLike; userId: string; workDate: string; time: string; btnClass: string }) {
  const [busy, setBusy] = useState<ApplyAction | null>(null)
  const DEFAULT_TIME = useWorkTimes().defaults // 출퇴근 기준시간(설정 > 08)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const rec = userId ? team.data?.rows.find((r) => r.user.id === userId)?.records[workDate] : undefined
  const hasIn = Boolean(rec?.checkInAt)
  const hasOut = Boolean(rec?.checkOutAt && !rec?.autoCheckout)
  const closed = rec?.status === 'absent' || rec?.status === 'vacation'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const nowHm = () => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

  const apply = async (action: ApplyAction) => {
    if (!userId) return setMsg({ ok: false, text: '직원을 선택해 주세요.' })
    const t = time || (workDate === today ? nowHm() : DEFAULT_TIME[action])
    setBusy(action)
    const res = await team.applyDay(userId, workDate, action, t)
    setBusy(null)
    setMsg(res.ok ? { ok: true, text: `${fmtYmdShort(workDate)} ${APPLY_LABEL[action]} ${t} 으로 처리했습니다.` } : { ok: false, text: res.error || '처리하지 못했습니다.' })
  }
  const disabled = (a: ApplyAction) => busy !== null || closed || (a === 'in' || a === 'in_late' ? hasIn : (rec !== undefined && !hasIn) || hasOut)
  const why = (a: ApplyAction) => (closed ? '결근·휴무로 처리된 날입니다' : a === 'in' || a === 'in_late' ? (hasIn ? '이미 출근 기록이 있습니다' : '') : hasOut ? '이미 퇴근 기록이 있습니다' : rec !== undefined && !hasIn ? '출근 기록이 없습니다' : '')

  return (
    <>
      {(Object.keys(APPLY_LABEL) as ApplyAction[]).map((a) => (
        <button key={a} type="button" className={btnClass} disabled={disabled(a)} title={why(a)} onClick={() => apply(a)}>
          {busy === a ? '처리 중…' : APPLY_LABEL[a]}
        </button>
      ))}
      {msg && <span className={msg.ok ? 'xs-ok xs-inline' : 'xs-err xs-inline'}>{msg.text}</span>}
    </>
  )
}
