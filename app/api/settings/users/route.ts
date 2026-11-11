import { NextResponse } from 'next/server'
import { z } from 'zod'
import { passwordSchema, toAuthPassword } from '@/lib/crm/server/password'
import { TABLES } from '@/lib/supabase/tables'
import { escapeLikePattern } from '@/lib/supabase/query-utils'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { assertAffiliationColumn, audit, requireSettings } from '@/lib/crm/server/settings'

const bodySchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(2, '아이디는 2자 이상이어야 합니다.')
    .max(30, '아이디는 30자까지 쓸 수 있어요.')
    .regex(/^[A-Za-z0-9._-]+$/, '아이디는 영문, 숫자, . _ - 만 쓸 수 있어요.'),
  password: passwordSchema,
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(30, '이름은 30자까지 쓸 수 있어요.'),
  email: z.string().trim().email('이메일 형식이 올바르지 않습니다.'),
  phone: z.string().trim().max(20, '전화번호가 너무 길어요.').regex(/^[0-9\-+ ]*$/, '전화번호는 숫자와 - 만 쓸 수 있어요.').optional().default(''),
  affiliationRoleId: z.string().uuid().nullable().optional()
})

// 아이디 생성: 여기서 만든 아이디/비밀번호로 바로 로그인할 수 있다. 기본 역할은 '직원'.
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    const body = bodySchema.parse(await request.json())
    await assertAffiliationColumn(ctx) // 마이그레이션 전에는 계정 생성을 막는다(역할 데이터가 섞이지 않게).

    const { data: dupId } = await ctx.db.from(TABLES.crmUsers).select('id').ilike('login_id', escapeLikePattern(body.loginId)).maybeSingle()
    if (dupId) throw new HttpError(409, '이미 사용 중인 아이디입니다.')
    if (await findAuthUserByEmail(ctx.db, body.email)) throw new HttpError(409, '이미 사용 중인 이메일입니다.')

    const { data: created, error: authError } = await ctx.db.auth.admin.createUser({
      email: body.email,
      password: toAuthPassword(body.password),
      email_confirm: true,
      user_metadata: { login_id: body.loginId, display_name: body.name }
    })
    if (authError || !created.user) throw new HttpError(400, authError?.message || '계정 생성에 실패했습니다.')

    const profile: Record<string, unknown> = {
      auth_user_id: created.user.id,
      login_id: body.loginId,
      email: body.email,
      name: body.name,
      phone: body.phone || null,
      role_type: 'staff',
      employment_status: 'active'
    }
    if (body.affiliationRoleId) profile.affiliation_role_id = body.affiliationRoleId

    const { data: user, error: profileError } = await ctx.db.from(TABLES.crmUsers).insert(profile).select('id').single()
    if (profileError || !user) {
      await ctx.db.auth.admin.deleteUser(created.user.id)
      throw profileError || new Error('프로필 생성 실패')
    }

    const { data: staffRole } = await ctx.db.from(TABLES.roles).select('id').eq('code', 'staff').maybeSingle()
    if (staffRole) await ctx.db.from(TABLES.userRoles).insert({ user_id: user.id, role_id: staffRole.id, granted_by: ctx.profile.id })

    await audit(ctx, 'create_user', 'crm_user', user.id, { login_id: body.loginId, name: body.name, affiliation_role_id: body.affiliationRoleId || null })
    return NextResponse.json({ ok: true, id: user.id })
  } catch (e) {
    return handleError(e, '아이디 생성 실패')
  }
}
