import { NextResponse } from 'next/server'
import { getFullWeekRangeKst, getKstYmd, getMonthRangeKst, getYmdList } from '@/lib/attendance/time'
import { getContext, handleError, loadRolesForUsers, requireMenu } from '@/lib/crm/server/context'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { closeOpenDays, loadDays } from '@/lib/crm/server/attendance'

// 직원 근태 통계 (주간 / 월간)
//  ?period=week|month (기본 month) &date=YYYY-MM-DD (그 날짜가 들어 있는 주/달, 기본 오늘)
// 집계 규칙: 출근 = 출근을 누른 날(지각도 포함), 지각 = 09:00 이후 출근,
//           퇴근 = 퇴근을 누른 날(23:59 자동 퇴근 제외), 야근 = 19:00 이후 퇴근, 결근 = 관리자 결근 처리
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance_team')
    const url = new URL(request.url)
    const today = getKstYmd(new Date())
    const period = url.searchParams.get('period') === 'week' ? 'week' : 'month'
    const dateParam = url.searchParams.get('date') || today
    const anchor = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today

    let start: string
    let end: string
    let label: string
    if (period === 'week') {
      ;({ start, end } = getFullWeekRangeKst(anchor))
      const [, sm, sd] = start.split('-').map(Number)
      const [, em, ed] = end.split('-').map(Number)
      label = `${start.slice(0, 4)}년 ${sm}월 ${sd}일 ~ ${em}월 ${ed}일 (주간)`
    } else {
      const [y, m] = anchor.split('-').map(Number)
      ;({ start, end } = getMonthRangeKst(y, m))
      label = `${y}년 ${m}월 (월간)`
    }
    const to = end < today ? end : today
    const from = start

    // 총 관리자(admin) 계정은 근태를 하지 않으므로 목록에서 뺀다
    const visible = (await loadVisibleUsers(ctx)).filter((u) => u.active)
    const { rolesByUser } = await loadRolesForUsers(ctx.db, visible.map((u) => ({ id: u.id, role_type: '', custom_role_code: null }) as any))
    const users = visible.filter((u) => !(rolesByUser.get(u.id) || []).some((r) => r.code === LOCKED_ROLE_CODE))
    const ids = users.map((u) => u.id)
    await closeOpenDays(ctx.db, ids)
    const records = from <= to ? await loadDays(ctx.db, ids, from, to) : []

    const rows = users.map((u) => {
      const mine = records.filter((r) => r.userId === u.id)
      const byDate: Record<string, (typeof mine)[number]> = {}
      for (const r of mine) byDate[r.workDate] = r
      const worked = mine.filter((r) => r.status !== 'absent')
      return {
        user: { id: u.id, name: u.name, loginId: u.loginId, affiliationName: u.affiliationName, roles: (rolesByUser.get(u.id) || []).map((r) => r.name) },
        summary: {
          present: worked.filter((r) => r.checkInAt).length, // 출근(지각 포함)
          late: worked.filter((r) => r.late).length,
          checkedOut: worked.filter((r) => r.checkOutAt && !r.autoCheckout).length,
          overtime: worked.filter((r) => r.overtime).length,
          absent: mine.filter((r) => r.status === 'absent').length,
          workedMinutes: worked.reduce((sum, r) => sum + r.workedMinutes, 0)
        },
        records: byDate
      }
    })

    const totals = rows.reduce(
      (acc, r) => ({
        present: acc.present + r.summary.present,
        late: acc.late + r.summary.late,
        checkedOut: acc.checkedOut + r.summary.checkedOut,
        overtime: acc.overtime + r.summary.overtime,
        absent: acc.absent + r.summary.absent,
        workedMinutes: acc.workedMinutes + r.summary.workedMinutes
      }),
      { present: 0, late: 0, checkedOut: 0, overtime: 0, absent: 0, workedMinutes: 0 }
    )

    return NextResponse.json({
      period,
      date: anchor,
      from,
      to,
      label,
      today,
      isCurrent: end >= today, // 이번 주/이번 달이면 '다음' 버튼을 막는다
      days: from <= to ? getYmdList(from, to) : [],
      rows,
      totals
    })
  } catch (e) {
    return handleError(e, '직원 근태 조회 실패')
  }
}
