import { NextResponse } from 'next/server'
import { addDaysToYmd, getKstYmd } from '@/lib/attendance/time'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { closeOpenDays, loadDays } from '@/lib/crm/server/attendance'

// 내 근태: 오늘 기록 + 최근 30일 기록(오늘 포함, 누른 시간 확인용)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance')
    await closeOpenDays(ctx.db, [ctx.profile.id])
    const today = getKstYmd(new Date())
    const days = await loadDays(ctx.db, [ctx.profile.id], addDaysToYmd(today, -30), today)
    const todayRecord = days.find((d) => d.workDate === today) || null
    return NextResponse.json({
      today,
      todayRecord,
      // 오늘도 기록(출근·결근 등)이 생기면 바로 최근 기록 맨 위에 보인다(퇴근 전이면 퇴근 칸은 비어 있다)
      history: days.filter((d) => d.workDate !== today || d.checkInAt || d.status === 'absent' || d.status === 'vacation').reverse()
    })
  } catch (e) {
    return handleError(e, '근태 조회 실패')
  }
}
