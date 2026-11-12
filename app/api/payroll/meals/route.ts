import { NextResponse } from 'next/server'
import { getKstYmd, getMonthRangeKst } from '@/lib/attendance/time'
import { getContext, handleError, loadRolesForUsers, requireMenu } from '@/lib/crm/server/context'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { loadDays } from '@/lib/crm/server/attendance'

// 급여계산 > 식대계산
//  ?month=YYYY-MM (기본 이번 달). 그 달 1일~말일(이번 달이면 오늘까지) 출근을 누른 날 수 × 1만 원.
//  결근 처리된 날은 세지 않는다. 대상: 모든 직원(총 관리자 계정 제외). 삭제된 직원은 그 달 출근이 있을 때만 '(전)'으로 나온다.
const MEAL_PER_DAY = 10000

export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'payroll')
    const url = new URL(request.url)
    const today = getKstYmd(new Date())
    const monthParam = url.searchParams.get('month') || today.slice(0, 7)
    const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7)
    const [y, m] = month.split('-').map(Number)
    const { start, end } = getMonthRangeKst(y, m)
    const to = end < today ? end : today

    const everyone = await loadVisibleUsers(ctx, { all: true })
    const { rolesByUser } = await loadRolesForUsers(ctx.db, everyone.map((u) => ({ id: u.id, role_type: '', custom_role_code: null }) as any))
    const users = everyone.filter((u) => !(rolesByUser.get(u.id) || []).some((r) => r.code === LOCKED_ROLE_CODE))
    const records = start <= to ? await loadDays(ctx.db, users.map((u) => u.id), start, to) : []

    const days = new Map<string, number>()
    for (const r of records) {
      if (!r.checkInAt || r.status === 'absent') continue
      days.set(r.userId, (days.get(r.userId) || 0) + 1)
    }

    const rows = users
      .map((u) => {
        const count = days.get(u.id) || 0
        return {
          user: { id: u.id, name: u.name, loginId: u.loginId, affiliation: u.affiliationName || null, active: u.active },
          days: count,
          amount: count * MEAL_PER_DAY
        }
      })
      .filter((r) => r.user.active || r.days > 0)
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko'))

    return NextResponse.json({
      month,
      label: `${y}년 ${m}월`,
      from: start,
      to: end,
      countedTo: to, // 이번 달이면 오늘까지 센 것
      isCurrent: end >= today,
      perDay: MEAL_PER_DAY,
      rows,
      totals: { days: rows.reduce((s, r) => s + r.days, 0), amount: rows.reduce((s, r) => s + r.amount, 0), people: rows.length }
    })
  } catch (e) {
    return handleError(e, '식대 계산 실패')
  }
}
