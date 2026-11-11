import { TABLES } from '@/lib/supabase/tables'
import { addDaysToYmd, getKstYmd, getLateThresholdIso, getYmdList } from '@/lib/attendance/time'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { loadRolesForUsers, type CrmContext } from '@/lib/crm/server/context'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { closeOpenDays, loadDays } from '@/lib/crm/server/attendance'

// 근태 미처리(설정 > 07 미처리)
// - 출근미처리: 평일(월~금)인데 출근 기록이 없는 날. 오늘은 09:00(지각 기준)이 지나야 넣는다.
//   결근·휴무로 처리한 날, 아이디가 생기기 전(입사일자·가입일 이전) 날은 뺀다. 최근 LOOKBACK_DAYS 일만 본다.
// - 퇴근미처리: 출근은 했는데 퇴근을 안 눌러 23:59 에 자동 퇴근된 날.
// 대상은 내가 볼 수 있는 사용 중 직원(총 관리자는 전체). 총 관리자 계정 자신은 근태를 하지 않으니 뺀다.
export const LOOKBACK_DAYS = 14

export type UnresolvedItem = {
  kind: 'in' | 'out'
  userId: string
  name: string
  loginId: string
  workDate: string
  checkInAt: string | null
}

export async function loadUnresolved(ctx: CrmContext) {
  const { db } = ctx
  const today = getKstYmd(new Date())
  const from = addDaysToYmd(today, -(LOOKBACK_DAYS - 1))
  const people = (await loadVisibleUsers(ctx)).filter((u) => u.active)
  if (!people.length) return { checkIn: [] as UnresolvedItem[], checkOut: [] as UnresolvedItem[], from, to: today }

  const { rolesByUser } = await loadRolesForUsers(
    db,
    people.map((p) => ({ id: p.id, role_type: '', custom_role_code: null }) as any)
  )
  const staff = people.filter((p) => !(rolesByUser.get(p.id) || []).some((r) => r.code === LOCKED_ROLE_CODE))
  const ids = staff.map((p) => p.id)
  if (!ids.length) return { checkIn: [] as UnresolvedItem[], checkOut: [] as UnresolvedItem[], from, to: today }

  // 언제부터 근태를 봐야 하는지: 입사일자(있으면)와 아이디를 만든 날 중 늦은 날
  const startOf = new Map<string, string>()
  const joined = await db.from(TABLES.crmUsers).select('id, joined_at').in('id', ids)
  for (const u of (joined.data || []) as any[]) startOf.set(u.id, getKstYmd(new Date(u.joined_at)))
  const hire = await db.from(TABLES.crmUsers).select('id, hire_date').in('id', ids)
  if (!hire.error) for (const u of (hire.data || []) as any[]) if (u.hire_date && u.hire_date > (startOf.get(u.id) || '')) startOf.set(u.id, u.hire_date)

  await closeOpenDays(db, ids)
  const records = await loadDays(db, ids, from, today)
  const byKey = new Map(records.map((r) => [`${r.userId}|${r.workDate}`, r]))
  const pastLate = new Date() > new Date(getLateThresholdIso(today))

  const checkIn: UnresolvedItem[] = []
  const checkOut: UnresolvedItem[] = []
  for (const p of staff) {
    const start = startOf.get(p.id) || from
    for (const d of getYmdList(from, today)) {
      if (d < start) continue
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay()
      if (dow === 0 || dow === 6) continue
      if (d === today && !pastLate) continue
      const r = byKey.get(`${p.id}|${d}`)
      if (r && (r.checkInAt || r.status === 'absent' || r.status === 'vacation')) continue
      checkIn.push({ kind: 'in', userId: p.id, name: p.name, loginId: p.loginId, workDate: d, checkInAt: null })
    }
  }
  for (const r of records) {
    if (!r.checkInAt || !r.autoCheckout || r.status === 'absent') continue
    const p = staff.find((x) => x.id === r.userId)
    if (p) checkOut.push({ kind: 'out', userId: p.id, name: p.name, loginId: p.loginId, workDate: r.workDate, checkInAt: r.checkInAt })
  }
  const sort = (a: UnresolvedItem, b: UnresolvedItem) => (a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : a.name.localeCompare(b.name, 'ko'))
  return { checkIn: checkIn.sort(sort), checkOut: checkOut.sort(sort), from, to: today }
}
