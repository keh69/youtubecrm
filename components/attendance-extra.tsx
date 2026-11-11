'use client'

import { useNow } from '@/lib/crm/client/hooks'
import { fmtHourMin, liveWorkedMinutes, statusLabel } from '@/lib/crm/client/format'
import type { DayRecord } from '@/lib/crm/client/types'

// 근태체크 요약 줄(모든 스킨 공통): "현재상태 : 출근 · 총 근무시간 : n시간nn분"
export function AttendanceSummary({ record }: { record: DayRecord | null }) {
  const now = useNow(1000)
  const worked = liveWorkedMinutes(record, now)
  return (
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
  )
}
