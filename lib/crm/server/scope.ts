import { TABLES } from '@/lib/supabase/tables'
import { HttpError, isMissingSchema, loadRolesForUsers, type CrmContext, type RoleRow } from '@/lib/crm/server/context'

export type ScopedUser = {
  id: string
  name: string
  loginId: string
  affiliationRoleId: string | null
  affiliationName: string | null
  active: boolean
}

// 내가 볼 수 있는 직원 목록.
// - 관리자 역할(총 관리자/관리자)을 가진 사람: 전체 직원
// - 그 외: 나 자신 + "소속"이 내가 가진 역할인 직원 + 그 직원들이 가진 역할에 소속된 직원 ... (아래로 계속)
//   예) 나 = 'A팀장' 역할 보유 → 소속이 'A팀장'인 팀원 전부. 팀원 중 누가 'B파트장' 역할도 있으면 그 밑 직원까지.
export async function loadVisibleUsers(ctx: CrmContext): Promise<ScopedUser[]> {
  const { db } = ctx
  let rows: any[] = []
  const full = await db
    .from(TABLES.crmUsers)
    .select('id, name, login_id, role_type, custom_role_code, employment_status, affiliation_role_id')
    .order('name', { ascending: true })
  if (full.error) {
    if (!isMissingSchema(full.error)) throw full.error
    const basic = await db
      .from(TABLES.crmUsers)
      .select('id, name, login_id, role_type, custom_role_code, employment_status')
      .order('name', { ascending: true })
    if (basic.error) throw basic.error
    rows = (basic.data || []).map((u: any) => ({ ...u, affiliation_role_id: null }))
  } else {
    rows = full.data || []
  }

  const { allRoles, rolesByUser } = await loadRolesForUsers(db, rows)
  const roleName = new Map(allRoles.map((r: RoleRow) => [r.id, r.name]))
  const toScoped = (u: any): ScopedUser => ({
    id: u.id,
    name: u.name,
    loginId: u.login_id,
    affiliationRoleId: u.affiliation_role_id || null,
    affiliationName: u.affiliation_role_id ? roleName.get(u.affiliation_role_id) || null : null,
    active: u.employment_status === 'active'
  })

  if (ctx.isAdmin) return rows.map(toScoped)

  const visible = new Set<string>([ctx.profile.id])
  const queue = [ctx.profile.id]
  const seenRoles = new Set<string>()
  while (queue.length) {
    const userId = queue.shift()!
    for (const role of rolesByUser.get(userId) || []) {
      if (seenRoles.has(role.id)) continue
      seenRoles.add(role.id)
      for (const u of rows) {
        if (u.affiliation_role_id === role.id && !visible.has(u.id)) {
          visible.add(u.id)
          queue.push(u.id)
        }
      }
    }
  }
  return rows.filter((u) => visible.has(u.id)).map(toScoped)
}

export async function assertCanSeeUser(ctx: CrmContext, userId: string) {
  if (userId === ctx.profile.id || ctx.isAdmin) return
  const visible = await loadVisibleUsers(ctx)
  if (!visible.some((u) => u.id === userId)) {
    throw new HttpError(403, '이 직원의 정보를 볼 권한이 없습니다.')
  }
}
