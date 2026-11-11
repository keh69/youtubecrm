import { NextResponse } from 'next/server'
import { getKstYmd, getYmdList } from '@/lib/attendance/time'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { closeOpenDays, loadDays } from '@/lib/crm/server/attendance'

// 직원 근태 통계 (월 단위). ?month=YYYY-MM (기본: 이번 달)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance_team')
    const url = new URL(request.url)
    const today = getKstYmd(new Date())
    const monthParam = url.searchParams.get('month') || today.slice(0, 7)
    const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7)
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const from = `${month}-01`
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`
    const to = monthEnd < today ? monthEnd : today

    const users = (await loadVisibleUsers(ctx)).filter((u) => u.active)
    const ids = users.map((u) => u.id)
    await closeOpenDays(ctx.db, ids)
    const records = from <= to ? await loadDays(ctx.db, ids, from, to) : []

    const rows = users.map((u) => {
      const mine = records.filter((r) => r.userId === u.id)
      const byDate: Record<string, (typeof mine)[number]> = {}
      for (const r of mine) byDate[r.workDate] = r
      return {
        user: { id: u.id, name: u.name, loginId: u.loginId, affiliationName: u.affiliationName },
        summary: {
          present: mine.filter((r) => r.status === 'present').length,
          late: mine.filter((r) => r.status === 'late').length,
          absent: mine.filter((r) => r.status === 'absent').length,
          workedMinutes: mine.reduce((sum, r) => sum + (r.status === 'absent' ? 0 : r.workedMinutes), 0)
        },
        records: byDate
      }
    })

    return NextResponse.json({ month, today, days: from <= to ? getYmdList(from, to) : [], rows })
  } catch (e) {
    return handleError(e, '직원 근태 조회 실패')
  }
}
