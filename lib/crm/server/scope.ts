import { TABLES } from '@/lib/supabase/tables'
import { HttpError, isMissingSchema, loadRolesForUsers, type CrmContext, type RoleRow } from '@/lib/crm/server/context'
import { loadAffiliationHiddenCodes, publicEmail } from '@/lib/crm/server/settings'
import { displayLoginId, formerName, isDeletedRow } from '@/lib/crm/server/deleted'

type Admin = CrmContext['db']

export type ScopedUser = {
  id: string
  name: string
  loginId: string
  affiliationUserId: string | null
  affiliationRoleId: string | null
  affiliationName: string | null
  active: boolean
}

export const AFFILIATION_USER_HINT = 'DB 업데이트가 필요합니다. supabase/sql/simple/210_affiliation_user.sql 을 Supabase SQL Editor에서 실행해 주세요.'

// 직원 행 읽기: 소속 칸(affiliation_user_id, affiliation_role_id)이 아직 없는 DB에서도 동작하게 단계적으로 시도한다.
// userColumn=false 면 '아이디 소속' 칸이 아직 없는 것(210 SQL 실행 전).
export async function selectUserRows(db: Admin, baseColumns: string, orderBy: string): Promise<{ rows: any[]; userColumn: boolean; roleColumn: boolean }> {
  const tries: Array<{ extra: string; userColumn: boolean; roleColumn: boolean }> = [
    { extra: ', affiliation_role_id, affiliation_user_id', userColumn: true, roleColumn: true },
    { extra: ', affiliation_role_id', userColumn: false, roleColumn: true },
    { extra: '', userColumn: false, roleColumn: false }
  ]
  for (const t of tries) {
    const { data, error } = await db.from(TABLES.crmUsers).select(baseColumns + t.extra).order(orderBy, { ascending: true })
    if (!error) {
      const rows = ((data || []) as any[]).map((u) => ({ affiliation_role_id: null, affiliation_user_id: null, ...u }))
      return { rows, userColumn: t.userColumn, roleColumn: t.roleColumn }
    }
    if (!isMissingSchema(error)) throw error
  }
  return { rows: [], userColumn: false, roleColumn: false }
}

// 소속 연결을 따라 rootId 아래에 있는 사람 전부(rootId 제외).
// - 아이디 소속(affiliation_user_id)이 있으면 그 사람 밑.
// - 아이디 소속이 없고 예전 역할 소속(affiliation_role_id)만 있으면, 그 역할을 가진 사람 밑으로 본다(옮기기 전 데이터 호환).
export function collectUnder(rows: any[], rolesByUser: Map<string, RoleRow[]>, rootId: string) {
  const under = new Set<string>()
  const queue = [rootId]
  const seenRoles = new Set<string>()
  while (queue.length) {
    const parentId = queue.shift()!
    const newRoles = new Set<string>()
    for (const r of rolesByUser.get(parentId) || []) {
      if (!seenRoles.has(r.id)) {
        seenRoles.add(r.id)
        newRoles.add(r.id)
      }
    }
    for (const u of rows) {
      if (u.id === rootId || under.has(u.id)) continue
      const linked = u.affiliation_user_id ? u.affiliation_user_id === parentId : Boolean(u.affiliation_role_id && newRoles.has(u.affiliation_role_id))
      if (linked) {
        under.add(u.id)
        queue.push(u.id)
      }
    }
  }
  return under
}

// 화면에 보일 소속 이름: 아이디 소속이면 그 사람 이름, 예전 역할 소속이면 역할 이름
export function affiliationNameOf(u: any, nameById: Map<string, string>, roleName: Map<string, string>) {
  if (u.affiliation_user_id) return nameById.get(u.affiliation_user_id) || null
  if (u.affiliation_role_id) return roleName.get(u.affiliation_role_id) || null
  return null
}

// 내가 볼 수 있는 직원 목록.
// - 총관리자(super_admin): 전체 직원
// - 그 외(관리자 포함): 나 자신 + 나에게 소속된 직원 + 그 직원에게 소속된 직원 ... (아래로 계속)
export async function loadVisibleUsers(ctx: CrmContext, opts: { all?: boolean } = {}): Promise<ScopedUser[]> {
  const { db } = ctx
  const { rows } = await selectUserRows(db, 'id, name, login_id, role_type, custom_role_code, employment_status', 'name')
  const { allRoles, rolesByUser } = await loadRolesForUsers(db, rows)
  const roleName = new Map(allRoles.map((r: RoleRow) => [r.id, r.name]))
  const nameById = new Map(rows.map((u) => [u.id, u.name]))
  // 삭제된 사원도 기록(영상·근태)이 남아 있으므로 목록에 두되, 이름은 '홍길동(전)'으로 보인다(사용 중 아님).
  const toScoped = (u: any): ScopedUser => ({
    id: u.id,
    name: isDeletedRow(u) ? formerName(u.name) : u.name,
    loginId: displayLoginId(u.login_id),
    affiliationUserId: u.affiliation_user_id || null,
    affiliationRoleId: u.affiliation_role_id || null,
    affiliationName: affiliationNameOf(u, nameById, roleName),
    active: u.employment_status === 'active'
  })

  if (ctx.isSuperAdmin || opts.all) return rows.map(toScoped)
  const visible = collectUnder(rows, rolesByUser, ctx.profile.id)
  visible.add(ctx.profile.id)
  return rows.filter((u) => visible.has(u.id)).map(toScoped)
}

export async function assertCanSeeUser(ctx: CrmContext, userId: string) {
  if (userId === ctx.profile.id || ctx.isSuperAdmin) return
  const visible = await loadVisibleUsers(ctx)
  if (!visible.some((u) => u.id === userId)) {
    throw new HttpError(403, '이 직원의 정보를 볼 권한이 없습니다.')
  }
}

export type Subordinate = ScopedUser & { email: string; phone: string; roles: string[]; isSuperAdmin: boolean; hireDate: string | null }

// 내 소속 하부 직원(나 제외): 관리자라도 "소속" 연결을 따라 내려간 사람만.
// 총 관리자(super_admin)는 하부와 상관없이 나를 뺀 모든 직원.
export async function loadSubordinates(ctx: CrmContext): Promise<Subordinate[]> {
  const { db } = ctx
  const { rows } = await selectUserRows(db, 'id, name, login_id, email, phone, role_type, custom_role_code, employment_status', 'name')
  const { allRoles, rolesByUser } = await loadRolesForUsers(db, rows)
  const roleName = new Map(allRoles.map((r: RoleRow) => [r.id, r.name]))
  const nameById = new Map(rows.map((u) => [u.id, u.name]))
  // 입사일자(220 SQL 전이면 칸이 없으니 비워 둔다)
  const hire = await db.from(TABLES.crmUsers).select('id, hire_date')
  const hireById = new Map<string, string | null>(hire.error ? [] : ((hire.data || []) as any[]).map((u) => [u.id, u.hire_date || null]))
  const under = ctx.isSuperAdmin ? new Set(rows.filter((u) => u.id !== ctx.profile.id).map((u) => u.id)) : collectUnder(rows, rolesByUser, ctx.profile.id)

  // 삭제된 사원은 사원목록에 나오지 않는다(기록은 06 덤프파일에서 본다)
  return rows
    .filter((u) => under.has(u.id) && !isDeletedRow(u))
    .map((u) => ({
      id: u.id,
      name: u.name,
      loginId: u.login_id,
      email: publicEmail(u.email),
      phone: u.phone || '',
      affiliationUserId: u.affiliation_user_id || null,
      affiliationRoleId: u.affiliation_role_id || null,
      affiliationName: affiliationNameOf(u, nameById, roleName),
      active: u.employment_status === 'active',
      roles: (rolesByUser.get(u.id) || []).map((r) => r.name),
      isSuperAdmin: (rolesByUser.get(u.id) || []).some((r) => r.code === 'super_admin'),
      hireDate: hireById.get(u.id) || null
    }))
}

// 소속으로 고를 수 있는 아이디인지 검사: 있는 아이디 + 사용 중 + 역할이 1개 이상.
// forUserId 가 있으면(소속 변경) 자기 자신이나 자기 밑에 있는 사람을 소속으로 고를 수 없다(빙빙 도는 연결 방지).
// listedOnly: 아이디 생성처럼 상세설정 '하부'가 켜진 역할의 아이디만 고를 수 있는 곳
export async function assertAffiliationTarget(ctx: Pick<CrmContext, 'db'>, targetId: string, forUserId?: string, listedOnly = false) {
  const { db } = ctx
  const { rows, userColumn } = await selectUserRows(db, 'id, name, role_type, custom_role_code, employment_status', 'name')
  if (!userColumn) throw new HttpError(409, AFFILIATION_USER_HINT)
  const target = rows.find((u) => u.id === targetId)
  if (!target) throw new HttpError(400, '소속으로 고른 아이디를 찾을 수 없습니다.')
  if (target.employment_status !== 'active') throw new HttpError(400, '사용 중지된 아이디에는 소속시킬 수 없습니다.')
  const { rolesByUser } = await loadRolesForUsers(db, rows)
  const targetRoles = rolesByUser.get(targetId) || []
  if (!targetRoles.length) throw new HttpError(400, '역할이 없는 아이디에는 소속시킬 수 없습니다.')
  if (listedOnly) {
    const hidden = await loadAffiliationHiddenCodes(db)
    if (!targetRoles.some((r) => !hidden.has(r.code))) throw new HttpError(400, `${target.name}님의 역할은 소속 목록에 나오지 않도록 설정되어 있습니다(상세설정 > 하부).`)
  }
  if (forUserId) {
    if (targetId === forUserId) throw new HttpError(400, '자기 자신에게 소속시킬 수 없습니다.')
    if (collectUnder(rows, rolesByUser, forUserId).has(targetId)) {
      throw new HttpError(400, `${target.name}님은 이 직원 밑에 있는 사람이라 소속으로 고를 수 없습니다.`)
    }
  }
}

export async function hasAffiliationUserColumn(db: Admin) {
  const { error } = await db.from(TABLES.crmUsers).select('affiliation_user_id').limit(1)
  if (error && !isMissingSchema(error)) throw error
  return !error
}
