import { z } from 'zod'
import { passwordSchema, toAuthPassword } from '@/lib/crm/server/password'
import { TABLES } from '@/lib/supabase/tables'
import { escapeLikePattern } from '@/lib/supabase/query-utils'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, type CrmContext } from '@/lib/crm/server/context'
import { assertAffiliationColumn, internalEmailFor } from '@/lib/crm/server/settings'
import { assertAffiliationTarget } from '@/lib/crm/server/scope'

type Db = CrmContext['db']

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
  affiliationRoleId: z.string().uuid().nullable().optional()
})
export type NewAccountInput = z.infer<typeof newAccountSchema>

// 아이디 하나 만들기: 로그인 계정 + 직원 정보 + 기본 역할 '직원'. 만든 직원의 id 를 돌려준다.
// grantedBy: 역할을 준 사람(설정에서 만들면 관리자, 회원가입이면 비움)
export async function createCrmAccount(db: Db, body: NewAccountInput, grantedBy: string | null) {
  await assertAffiliationColumn({ db }) // 마이그레이션 전에는 계정 생성을 막는다(역할 데이터가 섞이지 않게).
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

  const { data: user, error: profileError } = await db.from(TABLES.crmUsers).insert(profile).select('id').single()
  if (profileError || !user) {
    await db.auth.admin.deleteUser(created.user.id)
    throw profileError || new Error('프로필 생성 실패')
  }

  const { data: staffRole } = await db.from(TABLES.roles).select('id').eq('code', 'staff').maybeSingle()
  if (staffRole) await db.from(TABLES.userRoles).insert({ user_id: user.id, role_id: staffRole.id, granted_by: grantedBy })

  return user.id as string
}
