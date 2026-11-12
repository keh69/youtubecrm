import { NextResponse } from 'next/server'
import { z } from 'zod'
import { passwordSchema, toAuthPassword } from '@/lib/crm/server/password'
import { TABLES } from '@/lib/supabase/tables'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { onlyDigits } from '@/lib/crm/server/accounts'
import { assertAffiliationColumn, assertSuperAdminRemains, audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { assertAffiliationTarget, hasAffiliationUserColumn } from '@/lib/crm/server/scope'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(30).optional(),
  // 빈칸이면 바꾸지 않는다(내부용 주소를 쓰는 계정은 화면에 빈칸으로 보이기 때문).
  email: z.union([z.literal(''), z.string().trim().email('이메일 형식이 올바르지 않습니다.')]).optional(),
  // 전화번호는 숫자만 저장('-' 등은 뺀다)
  phone: z
    .string()
    .max(30)
    .optional()
    .transform((v) => (v === undefined ? undefined : onlyDigits(v)))
    .refine((v) => v === undefined || v.length <= 11, '전화번호는 숫자 11자리까지 쓸 수 있어요.'),
  affiliationUserId: z.string().uuid().nullable().optional(), // 소속 아이디(사람)
  affiliationRoleId: z.string().uuid().nullable().optional(), // 예전 스킨 호환용(역할 소속)
  password: passwordSchema.optional(),
  active: z.boolean().optional()
})

// 계정 정보 수정: 이름, 이메일, 전화번호, 소속, 비밀번호 재설정, 사용 중지/재개
export async function PATCH(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'assign')
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 계정입니다.')
    const body = patchSchema.parse(await request.json())

    const { data: target } = await ctx.db.from(TABLES.crmUsers).select('id, auth_user_id, email, login_id').eq('id', id).maybeSingle()
    if (!target) throw new HttpError(404, '계정을 찾을 수 없습니다.')

    if (body.active === false) {
      if (id === ctx.profile.id) throw new HttpError(400, '내 계정은 사용 중지할 수 없습니다.')
      await assertSuperAdminRemains(ctx, { userId: id, active: false })
    }
    if (body.affiliationRoleId !== undefined) await assertAffiliationColumn(ctx)
    if (body.affiliationUserId) await assertAffiliationTarget(ctx, body.affiliationUserId, id)
    else if (body.affiliationUserId === null) await assertAffiliationColumn(ctx)

    const authPatch: Record<string, unknown> = {}
    if (body.email && body.email.toLowerCase() !== String(target.email).toLowerCase()) {
      const other = await findAuthUserByEmail(ctx.db, body.email)
      if (other && other.id !== target.auth_user_id) throw new HttpError(409, '이미 사용 중인 이메일입니다.')
      authPatch.email = body.email
      authPatch.email_confirm = true
    }
    if (body.password) authPatch.password = toAuthPassword(body.password)
    if (Object.keys(authPatch).length) {
      const { error } = await ctx.db.auth.admin.updateUserById(target.auth_user_id, authPatch)
      if (error) throw new HttpError(400, error.message)
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) patch.name = body.name
    if (body.email) patch.email = body.email
    if (body.phone !== undefined) patch.phone = body.phone || null
    if (body.affiliationUserId !== undefined) {
      // 아이디 소속으로 정하면 예전 역할 소속은 지운다
      if (await hasAffiliationUserColumn(ctx.db)) patch.affiliation_user_id = body.affiliationUserId
      patch.affiliation_role_id = null
    } else if (body.affiliationRoleId !== undefined) {
      patch.affiliation_role_id = body.affiliationRoleId
      if (await hasAffiliationUserColumn(ctx.db)) patch.affiliation_user_id = null
    }
    if (body.active !== undefined) patch.employment_status = body.active ? 'active' : 'inactive'
    const { error } = await ctx.db.from(TABLES.crmUsers).update(patch).eq('id', id)
    if (error) throw error

    await audit(ctx, 'update_user', 'crm_user', id, { ...patch, password_reset: Boolean(body.password) })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '계정 수정 실패')
  }
}
