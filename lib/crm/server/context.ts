import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { TABLES } from '@/lib/supabase/tables'
import { verifyAccessToken } from '@/lib/auth/verify-token'
import { getBearerToken } from '@/lib/auth/session'
import { ADMIN_ROLE_CODES, LOCKED_ROLE_CODE, MENU_KEYS, RETIRED_ROLE_CODE, defaultMenusForRole, isMenuKey, type MenuKey } from '@/lib/crm/menus'

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

  return { db, profile, roles, menus: MENU_KEYS.filter((k) => menus.has(k)), isAdmin, isSuperAdmin }
}

export function requireMenu(ctx: CrmContext, key: MenuKey) {
  if (!ctx.menus.includes(key)) throw new HttpError(403, '이 메뉴를 사용할 권한이 없습니다.')
}
