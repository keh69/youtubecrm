import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { loadWorkHours } from '@/lib/crm/server/work-hours'
import { TABLES } from '@/lib/supabase/tables'
import { verifyAccessToken } from '@/lib/auth/verify-token'
import { getBearerToken } from '@/lib/auth/session'
import { ADMIN_ROLE_CODES, LOCKED_ROLE_CODE, MENU_KEYS, RETIRED_ROLE_CODE, SETTINGS_SUBS, SETTINGS_SUB_KEYS, defaultMenusForRole, isMenuKey, resolveSettingsSubs, ATTENDANCE_EDIT_MENU_KEY, STATS_ALL_MENU_KEY, type MenuKey, type SettingsSubKey } from '@/lib/crm/menus'

export type Admin = ReturnType<typeof createSupabaseAdminClient>

export type RoleRow = { id: string; code: string; name: string }

export type CrmProfile = {
  id: string
  name: string
  login_id: string
  email: string
  role_type: string
  custom_role_code: string | null
  employment_status: string
  affiliation_role_id?: string | null
  skin?: string | null
}

export type CrmContext = {
  db: Admin
  profile: CrmProfile
  roles: RoleRow[]
  menus: MenuKey[]
  isAdmin: boolean
  isSuperAdmin: boolean // 총관리자(super_admin): 모든 직원 데이터를 본다
  settingsTabs: SettingsSubKey[] // 설정 안에서 볼 수 있는 하부 메뉴(01~05)
  canEditAttendance: boolean // 근태통계 '수정가능': 달력에서 근태를 고치거나 지울 수 있다
  canSeeAllStats: boolean // 영상통계 '관리자': 전 직원 영상을 본다(아니면 내 영상만)
}

// 화면에 보여줄 수 있는 에러. 이 클래스로 던지면 status 와 메시지가 그대로 응답된다.
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function handleError(e: unknown, fallback: string) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  const issue = (e as any)?.issues?.[0]
  if (issue?.message) {
    return NextResponse.json({ error: issue.message }, { status: 400 })
  }
  console.error(fallback, e)
  const detail = process.env.NODE_ENV !== 'production' && e instanceof Error ? ` (${e.message})` : ''
  return NextResponse.json({ error: `${fallback}${detail}` }, { status: 500 })
}

// PostgREST 가 "컬럼/테이블 없음"으로 실패했는지. 마이그레이션 SQL 을 아직 안 돌렸을 때 안내용.
export function isMissingSchema(error: any) {
  const code = String(error?.code || '')
  const msg = String(error?.message || '')
  return code === '42703' || code === 'PGRST204' || code === '42P01' || code === 'PGRST205' || /column .* does not exist|could not find/i.test(msg)
}

export const MIGRATION_HINT = 'DB 업데이트가 필요합니다. supabase/sql/simple/200_simple_crm.sql 을 Supabase SQL Editor에서 실행해 주세요.'

export async function loadProfileByAuthId(db: Admin, authUserId: string): Promise<CrmProfile | null> {
  const full = await db
    .from(TABLES.crmUsers)
    .select('id, name, login_id, email, role_type, custom_role_code, employment_status, affiliation_role_id, skin')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (!full.error) return (full.data as CrmProfile) || null
  if (!isMissingSchema(full.error)) throw full.error
  const basic = await db
    .from(TABLES.crmUsers)
    .select('id, name, login_id, email, role_type, custom_role_code, employment_status')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (basic.error) throw basic.error
  return (basic.data as CrmProfile) || null
}

// 사용자 → 역할 목록. user_roles 가 비어 있으면(마이그레이션 전) 예전 직급 컬럼을 역할로 본다.
export async function loadRolesForUsers(db: Admin, users: Array<Pick<CrmProfile, 'id' | 'role_type' | 'custom_role_code'>>) {
  const [{ data: roleRows, error: rolesError }, { data: links, error: linksError }] = await Promise.all([
    db.from(TABLES.roles).select('id, code, name').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
    users.length
      ? db.from(TABLES.userRoles).select('user_id, role_id').in('user_id', users.map((u) => u.id))
      : Promise.resolve({ data: [] as Array<{ user_id: string; role_id: string }>, error: null })
  ])
  if (rolesError) throw rolesError
  if (linksError) throw linksError

  const allRoles = (roleRows || []) as RoleRow[]
  const byId = new Map(allRoles.map((r) => [r.id, r]))
  const byCode = new Map(allRoles.map((r) => [r.code, r]))
  const result = new Map<string, RoleRow[]>()
  for (const user of users) result.set(user.id, [])
  for (const link of (links || []) as Array<{ user_id: string; role_id: string }>) {
    const role = byId.get(link.role_id)
    if (role) result.get(link.user_id)?.push(role)
  }
  // 테이블 전체가 비어 있을 때만(=마이그레이션 전) 예전 직급을 쓴다. 역할을 전부 뺀 사람이 예전 직급으로 되살아나지 않게.
  let anyLinks = (links || []).length > 0
  if (!anyLinks) {
    const { count } = await db.from(TABLES.userRoles).select('id', { count: 'exact', head: true })
    anyLinks = Boolean(count)
  }
  if (!anyLinks) {
    for (const user of users) {
      const legacy = byCode.get(user.custom_role_code || user.role_type)
      if (legacy) result.set(user.id, [legacy])
    }
  }
  return { allRoles, rolesByUser: result }
}

// 역할 code → 볼 수 있는 메뉴. DB 에 새 메뉴 키가 한 번도 저장되지 않은 역할은 기본값을 쓴다.
export async function loadMenuMap(db: Admin, roleCodes: string[]) {
  const map = new Map<string, Set<MenuKey>>()
  if (roleCodes.length === 0) return map
  const { data, error } = await db
    .from(TABLES.roleMenuPermissions)
    .select('role_type, menu_key, can_view')
    .in('role_type', roleCodes)
  if (error) throw error
  const configured = new Map<string, Set<MenuKey>>()
  const configuredAny = new Set<string>()
  for (const row of (data || []) as Array<{ role_type: string; menu_key: string; can_view: boolean }>) {
    if (!isMenuKey(row.menu_key)) continue
    configuredAny.add(row.role_type)
    if (!configured.has(row.role_type)) configured.set(row.role_type, new Set())
    if (row.can_view) configured.get(row.role_type)!.add(row.menu_key)
  }
  for (const code of roleCodes) {
    if (code === LOCKED_ROLE_CODE) {
      map.set(code, new Set(MENU_KEYS))
    } else if (configuredAny.has(code)) {
      map.set(code, configured.get(code) || new Set())
    } else {
      map.set(code, new Set(defaultMenusForRole(code)))
    }
  }
  return map
}

export async function getContext(request: Request): Promise<CrmContext> {
  const claims = await verifyAccessToken(getBearerToken(request))
  if (!claims) throw new HttpError(401, '로그인이 필요합니다.')
  const db = createSupabaseAdminClient()
  await loadWorkHours(db) // 지각·야근 기준시간(설정 > 08 출퇴근시간)
  const profile = await loadProfileByAuthId(db, claims.sub)
  if (!profile) throw new HttpError(401, 'CRM 계정을 찾을 수 없습니다.')
  if (profile.employment_status !== 'active') throw new HttpError(403, '사용이 중지된 계정입니다. 관리자에게 문의해 주세요.')

  const { rolesByUser } = await loadRolesForUsers(db, [profile])
  const roles = rolesByUser.get(profile.id) || []
  if (roles.some((r) => r.code === RETIRED_ROLE_CODE) && roles.length === 1) {
    throw new HttpError(403, '퇴사 처리된 계정입니다.')
  }
  const menuMap = await loadMenuMap(db, roles.map((r) => r.code))
  const menus = new Set<MenuKey>()
  for (const set of menuMap.values()) for (const key of set) menus.add(key)
  const isAdmin = roles.some((r) => (ADMIN_ROLE_CODES as readonly string[]).includes(r.code))

  const isSuperAdmin = roles.some((r) => r.code === LOCKED_ROLE_CODE)

  // 설정 하부 메뉴: '설정'이 켜진 역할들의 허용 하부 메뉴 합집합(행이 없으면 허용). 총관리자는 전부.
  let settingsTabs: SettingsSubKey[] = []
  if (menus.has('settings')) {
    if (isSuperAdmin) settingsTabs = [...SETTINGS_SUB_KEYS]
    else {
      const codes = roles.filter((r) => menuMap.get(r.code)?.has('settings')).map((r) => r.code)
      const subMap = await loadSettingsSubMap(db, codes)
      const set = new Set<SettingsSubKey>()
      for (const c of codes) for (const k of subMap.get(c) || []) set.add(k)
      settingsTabs = SETTINGS_SUB_KEYS.filter((k) => set.has(k))
    }
  }

  // 근태통계 '수정가능': 총 관리자는 항상, 그 외에는 근태통계가 켜진 역할 중 하나라도 수정가능이 켜져 있으면
  let canEditAttendance = isSuperAdmin
  if (!canEditAttendance && menus.has('attendance_team')) {
    const codes = roles.filter((r) => menuMap.get(r.code)?.has('attendance_team')).map((r) => r.code)
    canEditAttendance = (await loadRoleFlagCodes(db, ATTENDANCE_EDIT_MENU_KEY, codes)).size > 0
  }
  // 영상통계 '관리자': 총 관리자는 항상, 그 외에는 영상통계가 켜진 역할 중 하나라도 '관리자'가 켜져 있으면
  let canSeeAllStats = isSuperAdmin
  if (!canSeeAllStats && menus.has('stats')) {
    const codes = roles.filter((r) => menuMap.get(r.code)?.has('stats')).map((r) => r.code)
    canSeeAllStats = (await loadRoleFlagCodes(db, STATS_ALL_MENU_KEY, codes)).size > 0
  }

  return { db, profile, roles, menus: MENU_KEYS.filter((k) => menus.has(k)), isAdmin, isSuperAdmin, settingsTabs, canEditAttendance, canSeeAllStats }
}

// 역할별 켜기/끄기 표시(근태 '수정가능', 영상통계 '관리자' 등)가 켜진 역할 code 목록
export async function loadRoleFlagCodes(db: Admin, menuKey: string, roleCodes?: string[]) {
  let q = db.from(TABLES.roleMenuPermissions).select('role_type').eq('menu_key', menuKey).eq('can_view', true)
  if (roleCodes) {
    if (!roleCodes.length) return new Set<string>()
    q = q.in('role_type', roleCodes)
  }
  const { data, error } = await q
  if (error) throw error
  return new Set((data || []).map((r: any) => r.role_type as string))
}

export function requireMenu(ctx: CrmContext, key: MenuKey) {
  if (!ctx.menus.includes(key)) throw new HttpError(403, '이 메뉴를 사용할 권한이 없습니다.')
}

// 역할 code → 설정 안에서 보이는 하부 메뉴(01~05). 저장된 행이 없으면 보임, can_view=false 면 숨김.
export async function loadSettingsSubMap(db: Admin, roleCodes: string[]) {
  const map = new Map<string, SettingsSubKey[]>()
  if (roleCodes.length === 0) return map
  const { data, error } = await db
    .from(TABLES.roleMenuPermissions)
    .select('role_type, menu_key, can_view')
    .in('role_type', roleCodes)
    .in('menu_key', SETTINGS_SUBS.map((s) => s.menuKey))
  if (error) throw error
  const stored = new Map((data || []).map((r: any) => [`${r.role_type}|${r.menu_key}`, Boolean(r.can_view)]))
  for (const code of roleCodes) {
    map.set(code, code === LOCKED_ROLE_CODE ? [...SETTINGS_SUB_KEYS] : resolveSettingsSubs((menuKey) => stored.get(`${code}|${menuKey}`)))
  }
  return map
}
