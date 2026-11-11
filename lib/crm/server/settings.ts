import { TABLES } from '@/lib/supabase/tables'
import { ADMIN_ROLE_CODES, LOCKED_ROLE_CODE, MENU_KEYS, SETTINGS_SUBS, type MenuKey, type SettingsSubKey } from '@/lib/crm/menus'
import { HttpError, MIGRATION_HINT, isMissingSchema, loadMenuMap, loadRolesForUsers, loadSettingsSubMap, requireMenu, type CrmContext } from '@/lib/crm/server/context'

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

export function isSystemRole(code: string) {
  return (ADMIN_ROLE_CODES as readonly string[]).includes(code)
}

export async function loadSettingsOverview(ctx: CrmContext) {
  const { db } = ctx
  let migrated = true
  let userRows: any[] = []
  const full = await db
    .from(TABLES.crmUsers)
    .select('id, login_id, name, email, phone, role_type, custom_role_code, employment_status, affiliation_role_id, joined_at')
    .order('joined_at', { ascending: true })
  if (full.error) {
    if (!isMissingSchema(full.error)) throw full.error
    migrated = false
    const basic = await db
      .from(TABLES.crmUsers)
      .select('id, login_id, name, email, phone, role_type, custom_role_code, employment_status, joined_at')
      .order('joined_at', { ascending: true })
    if (basic.error) throw basic.error
    userRows = (basic.data || []).map((u: any) => ({ ...u, affiliation_role_id: null }))
  } else {
    userRows = full.data || []
  }

  const { allRoles, rolesByUser } = await loadRolesForUsers(db, userRows)
  const menuMap = await loadMenuMap(db, allRoles.map((r) => r.code))
  const subMap = await loadSettingsSubMap(db, allRoles.map((r) => r.code))

  const roles = allRoles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    system: isSystemRole(r.code),
    locked: r.code === LOCKED_ROLE_CODE,
    menus: MENU_KEYS.filter((k) => menuMap.get(r.code)?.has(k)),
    settingsTabs: subMap.get(r.code) || [],
    holderCount: userRows.filter((u) => (rolesByUser.get(u.id) || []).some((x) => x.id === r.id)).length,
    memberCount: userRows.filter((u) => u.affiliation_role_id === r.id).length
  }))

  const users = userRows.map((u) => ({
    id: u.id,
    loginId: u.login_id,
    name: u.name,
    email: publicEmail(u.email),
    phone: u.phone || '',
    affiliationRoleId: u.affiliation_role_id || null,
    roleIds: (rolesByUser.get(u.id) || []).map((r) => r.id),
    active: u.employment_status === 'active'
  }))

  return { roles, users, migrated, isSuperAdmin: ctx.roles.some((r) => r.code === LOCKED_ROLE_CODE) }
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

export async function assertAffiliationColumn(ctx: CrmContext) {
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
