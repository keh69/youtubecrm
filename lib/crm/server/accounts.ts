import { z } from 'zod'
import { passwordSchema, toAuthPassword } from '@/lib/crm/server/password'
import { TABLES } from '@/lib/supabase/tables'
import { escapeLikePattern } from '@/lib/supabase/query-utils'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, type CrmContext } from '@/lib/crm/server/context'
import { LOCKED_ROLE_CODE, RETIRED_ROLE_CODE, SIGNUP_ROLE_MENU_KEY } from '@/lib/crm/menus'
import { INTERNAL_EMAIL_DOMAIN, assertAffiliationColumn, internalEmailFor } from '@/lib/crm/server/settings'
import { assertAffiliationTarget } from '@/lib/crm/server/scope'
import { DELETED_STATUS, DEL_MARK, displayLoginId } from '@/lib/crm/server/deleted'

type Db = CrmContext['db']

// 입사일자: 화면에서는 2026.11.11 로 보이고, 서버에는 2026-11-11 로 온다. 비우면 저장하지 않는다.
export const hireDateSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/,'입사일자는 2026.11.11 처럼 적어 주세요.')
      .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`)
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= '1950-01-01' && v <= `${new Date().getUTCFullYear() + 1}-12-31`
      }, '입사일자가 올바른 날짜가 아닙니다.')
  ])
  .optional()
  .default('')

export const HIRE_DATE_HINT = 'DB 업데이트가 필요합니다. supabase/sql/simple/220_hire_date.sql 을 Supabase SQL Editor에서 실행해 주세요. (그 전에는 입사일자가 저장되지 않습니다)'

// 입사일자 칸이 아직 없으면(220 SQL 실행 전) 입사일자만 빼고 다시 저장한다
function isMissingHireDate(error: any) {
  return /hire_date/.test(String(error?.message || '')) && /column|schema cache|could not find/i.test(String(error?.message || ''))
}

// 아이디 만들기(설정 > 04)와 회원가입이 같이 쓰는 입력 규칙
export const newAccountSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(2, '아이디는 2자 이상이어야 합니다.')
    .max(30, '아이디는 30자까지 쓸 수 있어요.')
    .regex(/^[A-Za-z0-9._-]+$/, '아이디는 영문, 숫자, . _ - 만 쓸 수 있어요.'),
  password: passwordSchema,
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(30, '이름은 30자까지 쓸 수 있어요.'),
  // 이메일은 선택: 비우면 내부용 주소를 대신 붙인다.
  email: z.union([z.literal(''), z.string().trim().email('이메일 형식이 올바르지 않습니다.')]).optional().default(''),
  phone: z.string().trim().max(20, '전화번호가 너무 길어요.').regex(/^[0-9\-+ ]*$/, '전화번호는 숫자와 - 만 쓸 수 있어요.').optional().default(''),
  // 소속: 역할이 있는 아이디(사람)를 고른다. affiliationRoleId 는 예전 스킨 호환용(역할 소속).
  affiliationUserId: z.string().uuid().nullable().optional(),
  affiliationRoleId: z.string().uuid().nullable().optional(),
  hireDate: hireDateSchema
})
export type NewAccountInput = z.infer<typeof newAccountSchema>

// 새 아이디가 받을 기본 역할(가입역할):
//  1) 상세설정 '회원가입 시 역할'에서 고른 역할
//  2) 없으면 'staff'(직원) 역할, 3) 그것도 없으면 역할설정 표 맨 아래 역할(총 관리자·퇴사 제외).
// 예전에는 'staff' 만 찾아서, 그 역할을 지우면 새 아이디가 역할 없이 만들어져 로그인해도 볼 메뉴가 없었다.
// 가입역할 바꾸기: 고른 역할 하나에만 표시를 남긴다
export async function setSignupRole(db: Db, roleCode: string) {
  if (roleCode === LOCKED_ROLE_CODE || roleCode === RETIRED_ROLE_CODE) throw new HttpError(400, '이 역할은 가입역할로 정할 수 없습니다.')
  const { error: delError } = await db.from(TABLES.roleMenuPermissions).delete().eq('menu_key', SIGNUP_ROLE_MENU_KEY)
  if (delError) throw delError
  const { error } = await db.from(TABLES.roleMenuPermissions).insert({ role_type: roleCode, menu_key: SIGNUP_ROLE_MENU_KEY, can_view: true, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function pickDefaultRole(db: Db) {
  const { data, error } = await db
    .from(TABLES.roles)
    .select('id, code, name')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  const roles = (data || []) as Array<{ id: string; code: string; name: string }>
  const usableRole = (r: { code: string }) => r.code !== LOCKED_ROLE_CODE && r.code !== RETIRED_ROLE_CODE
  const { data: picked } = await db.from(TABLES.roleMenuPermissions).select('role_type').eq('menu_key', SIGNUP_ROLE_MENU_KEY).eq('can_view', true)
  const chosen = roles.find((r) => usableRole(r) && (picked || []).some((p: any) => p.role_type === r.code))
  if (chosen) return chosen
  const staff = roles.find((r) => r.code === 'staff')
  if (staff) return staff
  const usable = roles.filter((r) => r.code !== LOCKED_ROLE_CODE && r.code !== RETIRED_ROLE_CODE)
  return usable[usable.length - 1] || null
}

// 아이디 하나 만들기: 로그인 계정 + 직원 정보 + 기본 역할. 만든 직원의 id 를 돌려준다.
// grantedBy: 역할을 준 사람(설정에서 만들면 관리자, 회원가입이면 비움)
export async function createCrmAccount(db: Db, body: NewAccountInput, grantedBy: string | null) {
  await assertAffiliationColumn({ db }) // 마이그레이션 전에는 계정 생성을 막는다(역할 데이터가 섞이지 않게).
  const defaultRole = await pickDefaultRole(db)
  if (!defaultRole) throw new HttpError(400, '새 아이디에 줄 역할이 없습니다. 설정 > 역할설정에서 역할을 하나 만들어 주세요.')
  if (body.affiliationUserId) await assertAffiliationTarget({ db }, body.affiliationUserId, undefined, true)

  const { data: dupId } = await db.from(TABLES.crmUsers).select('id').ilike('login_id', escapeLikePattern(body.loginId)).maybeSingle()
  if (dupId) throw new HttpError(409, '이미 사용 중인 아이디입니다.')
  const email = body.email || internalEmailFor(body.loginId)
  if (await findAuthUserByEmail(db, email)) throw new HttpError(409, body.email ? '이미 사용 중인 이메일입니다.' : '이미 사용 중인 아이디입니다.')

  const { data: created, error: authError } = await db.auth.admin.createUser({
    email,
    password: toAuthPassword(body.password),
    email_confirm: true,
    user_metadata: { login_id: body.loginId, display_name: body.name }
  })
  if (authError || !created.user) throw new HttpError(400, authError?.message || '계정 생성에 실패했습니다.')

  const profile: Record<string, unknown> = {
    auth_user_id: created.user.id,
    login_id: body.loginId,
    email,
    name: body.name,
    phone: body.phone || null,
    role_type: 'staff',
    employment_status: 'active'
  }
  if (body.affiliationUserId) profile.affiliation_user_id = body.affiliationUserId
  else if (body.affiliationRoleId) profile.affiliation_role_id = body.affiliationRoleId

  if (body.hireDate) profile.hire_date = body.hireDate
  let { data: user, error: profileError } = await db.from(TABLES.crmUsers).insert(profile).select('id').single()
  if (profileError && body.hireDate && isMissingHireDate(profileError)) {
    delete profile.hire_date
    ;({ data: user, error: profileError } = await db.from(TABLES.crmUsers).insert(profile).select('id').single())
  }
  if (profileError || !user) {
    await db.auth.admin.deleteUser(created.user.id)
    throw profileError || new Error('프로필 생성 실패')
  }

  const { error: roleError } = await db.from(TABLES.userRoles).insert({ user_id: user.id, role_id: defaultRole.id, granted_by: grantedBy })
  if (roleError) throw roleError

  return user.id as string
}

/* ───────── 사원 삭제(기록 보존) ─────────
   직원 정보를 지우면 DB가 그 사람의 영상·근태 기록까지 같이 지우게 되어 있어서, 실제로 지우지 않고 "삭제됨"으로 표시한다.
   - employment_status = 'suspended' 를 '삭제됨'으로 쓴다(DB 허용값 중 다른 곳에서 쓰지 않는 값).
   - 아이디 뒤에 ~del~xxxxxx 를 붙여 같은 아이디로 다시 가입할 수 있게 비워 준다(아이디 규칙상 ~ 는 사람이 쓸 수 없다).
   - 로그인 계정은 이메일을 바꾸고 막아서 다시 들어올 수 없게 한다.
   - 영상·근태 기록은 그대로 남고, 설정 > 06 덤프파일에서 본다. 이름은 '홍길동(전)'으로 보인다. */

export async function softDeleteAccount(db: Db, target: { id: string; auth_user_id: string; login_id: string }) {
  const tag = Math.random().toString(36).slice(2, 8)
  const parkedEmail = `deleted-${target.id}@${INTERNAL_EMAIL_DOMAIN}`
  const { error: authError } = await db.auth.admin.updateUserById(target.auth_user_id, {
    email: parkedEmail,
    email_confirm: true,
    password: `ycrm:${crypto.randomUUID()}`,
    ban_duration: '876000h' // 약 100년: 다시 로그인할 수 없다
  })
  if (authError) throw new HttpError(400, authError.message)
  const { error } = await db
    .from(TABLES.crmUsers)
    .update({ employment_status: DELETED_STATUS, login_id: `${displayLoginId(target.login_id)}${DEL_MARK}${tag}`, email: parkedEmail, updated_at: new Date().toISOString() })
    .eq('id', target.id)
  if (error) throw error
}

// 사원목록 > 편집: 이름·이메일·전화번호
export const employeeEditSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(30, '이름은 30자까지 쓸 수 있어요.'),
  // 빈칸이면 이메일은 바꾸지 않는다(내부용 주소를 쓰는 계정은 화면에 빈칸으로 보이기 때문)
  email: z.union([z.literal(''), z.string().trim().email('이메일 형식이 올바르지 않습니다.')]).optional().default(''),
  phone: z.string().trim().max(20, '전화번호가 너무 길어요.').regex(/^[0-9\-+ ]*$/, '전화번호는 숫자와 - 만 쓸 수 있어요.').optional().default(''),
  hireDate: hireDateSchema
})

export async function updateEmployeeBasics(db: Db, target: { id: string; auth_user_id: string; email: string }, body: z.infer<typeof employeeEditSchema>) {
  const patch: Record<string, unknown> = { name: body.name, phone: body.phone || null, updated_at: new Date().toISOString() }
  if (body.email && body.email.toLowerCase() !== String(target.email).toLowerCase()) {
    const other = await findAuthUserByEmail(db, body.email)
    if (other && other.id !== target.auth_user_id) throw new HttpError(409, '이미 사용 중인 이메일입니다.')
    const { error } = await db.auth.admin.updateUserById(target.auth_user_id, { email: body.email, email_confirm: true })
    if (error) throw new HttpError(400, error.message)
    patch.email = body.email
  }
  patch.hire_date = body.hireDate || null
  const { error } = await db.from(TABLES.crmUsers).update(patch).eq('id', target.id)
  if (error && isMissingHireDate(error)) throw new HttpError(409, HIRE_DATE_HINT)
  if (error) throw error
}
