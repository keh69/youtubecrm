import { NextResponse } from 'next/server'
import { addDaysToYmd, getKstYmd } from '@/lib/attendance/time'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { closeOpenDays, loadDays } from '@/lib/crm/server/attendance'

// 내 근태: 오늘 기록 + 최근 30일 기록(누른 시간 확인용)
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
      history: days.filter((d) => d.workDate !== today).reverse()
    })
  } catch (e) {
    return handleError(e, '근태 조회 실패')
  }
}
