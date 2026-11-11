import { TABLES } from '@/lib/supabase/tables'
import { ATTENDANCE_EDIT_MENU_KEY, AFFILIATION_MENU_KEY, LOCKED_ROLE_CODE, MENU_KEYS, SETTINGS_SUBS, type MenuKey, type SettingsSubKey } from '@/lib/crm/menus'
import { HttpError, MIGRATION_HINT, isMissingSchema, loadAttendanceEditCodes, loadMenuMap, loadRolesForUsers, loadSettingsSubMap, requireMenu, type CrmContext } from '@/lib/crm/server/context'
import { selectUserRows } from '@/lib/crm/server/scope'
import { isDeletedRow } from '@/lib/crm/server/deleted'
import { pickDefaultRole } from '@/lib/crm/server/accounts'

export function requireSettings(ctx: CrmContext) {
  requireMenu(ctx, 'settings')
}

// 설정 안의 하부 메뉴(01 사원목록, 02 역할부여, 03 역할설정, 04 아이디생성) 권한 검사
export function requireSettingsTab(ctx: CrmContext, tab: SettingsSubKey) {
  requireSettings(ctx)
  if (!ctx.settingsTabs.includes(tab)) {
    const label = SETTINGS_SUBS.find((s) => s.key === tab)?.label || tab
    throw new HttpError(403, `설정의 '${label}' 메뉴를 사용할 권한이 없습니다.`)
  }
}

// 역할 하나의 설정 하부 메뉴 보이기/안 보이기 저장
export async function saveRoleSettingsTabs(ctx: CrmContext, code: string, tabs: SettingsSubKey[]) {
  if (code === LOCKED_ROLE_CODE) throw new HttpError(400, '총 관리자는 항상 설정 메뉴 전부를 봅니다(변경 불가).')
  const now = new Date().toISOString()
  const rows = SETTINGS_SUBS.map((s) => ({ role_type: code, menu_key: s.menuKey, can_view: tabs.includes(s.key), updated_at: now }))
  const { error } = await ctx.db.from(TABLES.roleMenuPermissions).upsert(rows, { onConflict: 'role_type,menu_key' })
  if (error) throw error
}

// 상세설정 '하부'가 꺼진 역할 code 목록(아이디 생성의 소속 목록에서 이 역할의 아이디를 뺀다)
export async function loadAffiliationHiddenCodes(db: CrmContext['db']) {
  const { data, error } = await db.from(TABLES.roleMenuPermissions).select('role_type, can_view').eq('menu_key', AFFILIATION_MENU_KEY)
  if (error) throw error
  return new Set((data || []).filter((r: any) => !r.can_view).map((r: any) => r.role_type as string))
}

export async function saveRoleAttendanceEdit(ctx: CrmContext, code: string, on: boolean) {
  if (code === LOCKED_ROLE_CODE) throw new HttpError(400, '총 관리자는 항상 근태를 고칠 수 있습니다(변경 불가).')
  const { error } = await ctx.db
    .from(TABLES.roleMenuPermissions)
    .upsert([{ role_type: code, menu_key: ATTENDANCE_EDIT_MENU_KEY, can_view: on, updated_at: new Date().toISOString() }], { onConflict: 'role_type,menu_key' })
  if (error) throw error
}

export async function saveRoleAffiliationVisible(ctx: CrmContext, code: string, visible: boolean) {
  const { error } = await ctx.db
    .from(TABLES.roleMenuPermissions)
    .upsert([{ role_type: code, menu_key: AFFILIATION_MENU_KEY, can_view: visible, updated_at: new Date().toISOString() }], { onConflict: 'role_type,menu_key' })
  if (error) throw error
}

// 지울 수 없는 기본 역할: 총 관리자만(잠금 방지). '관리자'는 2026-11-11부터 다른 역할처럼 삭제할 수 있다.
export function isSystemRole(code: string) {
  return code === LOCKED_ROLE_CODE
}

export async function loadSettingsOverview(ctx: CrmContext) {
  const { db } = ctx
  const sel = await selectUserRows(db, 'id, login_id, name, email, phone, role_type, custom_role_code, employment_status, joined_at', 'joined_at')
  const userRows = sel.rows
  const migrated = sel.roleColumn
  const affiliationUserReady = sel.userColumn // 210 SQL(아이디 소속 칸) 실행 여부

  const { allRoles, rolesByUser } = await loadRolesForUsers(db, userRows)
  const menuMap = await loadMenuMap(db, allRoles.map((r) => r.code))
  const subMap = await loadSettingsSubMap(db, allRoles.map((r) => r.code))
  const affHidden = await loadAffiliationHiddenCodes(db)
  const signupRole = await pickDefaultRole(db) // 지금 실제로 쓰이는 가입역할
  const attEdit = await loadAttendanceEditCodes(db)

  const roles = allRoles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    system: isSystemRole(r.code),
    locked: r.code === LOCKED_ROLE_CODE,
    menus: MENU_KEYS.filter((k) => menuMap.get(r.code)?.has(k)),
    settingsTabs: subMap.get(r.code) || [],
    affiliationVisible: !affHidden.has(r.code),
    attendanceEdit: r.code === LOCKED_ROLE_CODE || attEdit.has(r.code), // 근태통계 '수정가능'
    signupRole: signupRole?.id === r.id, // 회원가입·아이디 만들기에서 새 아이디가 받는 역할(삭제 불가)
    holderCount: userRows.filter((u) => !isDeletedRow(u) && (rolesByUser.get(u.id) || []).some((x) => x.id === r.id)).length,
    // 이 역할을 가진 사람에게 소속된 인원(예전 역할 소속 포함)
    memberCount: userRows.filter(
      (u) =>
        !isDeletedRow(u) &&
        (u.affiliation_user_id ? (rolesByUser.get(u.affiliation_user_id) || []).some((x) => x.id === r.id) : u.affiliation_role_id === r.id)
    ).length
  }))

  // 삭제된 사원은 역할부여·소속 목록에서 빼고, 이름만 따로 넘긴다(누가 그 사람에게 소속돼 있으면 '홍길동(전)'으로 보이게)
  const formerUsers = userRows.filter(isDeletedRow).map((u) => ({ id: u.id as string, name: u.name as string }))
  const users = userRows.filter((u) => !isDeletedRow(u)).map((u) => ({
    id: u.id,
    loginId: u.login_id,
    name: u.name,
    email: publicEmail(u.email),
    phone: u.phone || '',
    affiliationRoleId: u.affiliation_role_id || null,
    affiliationUserId: u.affiliation_user_id || null,
    roleIds: (rolesByUser.get(u.id) || []).map((r) => r.id),
    active: u.employment_status === 'active'
  }))

  return { roles, users, formerUsers, migrated, affiliationUserReady, isSuperAdmin: ctx.roles.some((r) => r.code === LOCKED_ROLE_CODE) }
}

export async function assertRoleNameFree(ctx: CrmContext, name: string, exceptId?: string) {
  const { data } = await ctx.db.from(TABLES.roles).select('id, name')
  const clash = (data || []).find((r: any) => r.name.trim().toLowerCase() === name.trim().toLowerCase() && r.id !== exceptId)
  if (clash) throw new HttpError(409, `'${name}' 역할이 이미 있습니다.`)
}

export async function saveRoleMenus(ctx: CrmContext, code: string, menus: MenuKey[]) {
  if (code === LOCKED_ROLE_CODE) throw new HttpError(400, '총 관리자는 항상 모든 메뉴를 봅니다(변경 불가).')
  const now = new Date().toISOString()
  const rows = MENU_KEYS.map((key) => ({ role_type: code, menu_key: key, can_view: menus.includes(key), updated_at: now }))
  const { error } = await ctx.db.from(TABLES.roleMenuPermissions).upsert(rows, { onConflict: 'role_type,menu_key' })
  if (error) throw error
}

// 총 관리자 역할을 가진 활성 계정이 최소 1명은 남아 있어야 한다(잠금 방지).
export async function assertSuperAdminRemains(ctx: CrmContext, change: { userId: string; roleIds?: string[]; active?: boolean }) {
  const { data: superRole } = await ctx.db.from(TABLES.roles).select('id').eq('code', LOCKED_ROLE_CODE).maybeSingle()
  if (!superRole) return
  const overview = await loadSettingsOverview(ctx)
  const remaining = overview.users.filter((u) => {
    const roleIds = u.id === change.userId && change.roleIds ? change.roleIds : u.roleIds
    const active = u.id === change.userId && change.active !== undefined ? change.active : u.active
    return active && roleIds.includes(superRole.id)
  })
  if (remaining.length === 0) throw new HttpError(400, '총 관리자 역할을 가진 계정이 최소 1명은 있어야 합니다.')
}

export async function assertAffiliationColumn(ctx: Pick<CrmContext, 'db'>) {
  const { error } = await ctx.db.from(TABLES.crmUsers).select('affiliation_role_id').limit(1)
  if (error && isMissingSchema(error)) throw new HttpError(409, MIGRATION_HINT)
}

export async function audit(ctx: CrmContext, action: string, targetType: string, targetId: string | null, diff: Record<string, unknown>) {
  await ctx.db.from(TABLES.auditLogs).insert({ actor_user_id: ctx.profile.id, action_type: action, target_type: targetType, target_id: targetId, diff_summary: diff })
}

// 이메일 없이 만든 계정: Supabase 로그인 시스템은 이메일이 꼭 필요해서 화면에 안 보이는 내부용 주소를 붙인다.
// 로그인은 아이디로 하므로 이 주소는 아무도 쓰지 않는다(메일도 보내지 않음). 화면에는 빈칸으로 보인다.
export const INTERNAL_EMAIL_DOMAIN = 'noemail.youtubecrm.app'
export function internalEmailFor(loginId: string) {
  return `${loginId.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`
}
export function publicEmail(email: string | null | undefined) {
  return email && !email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`) ? email : ''
}
