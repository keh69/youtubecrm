import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { assertAffiliationColumn, assertSuperAdminRemains, audit, requireSettings } from '@/lib/crm/server/settings'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(30).optional(),
  email: z.string().trim().email('이메일 형식이 올바르지 않습니다.').optional(),
  phone: z.string().trim().max(20).regex(/^[0-9\-+ ]*$/, '전화번호는 숫자와 - 만 쓸 수 있어요.').optional(),
  affiliationRoleId: z.string().uuid().nullable().optional(),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다.').max(72).optional(),
  active: z.boolean().optional()
})

// 계정 정보 수정: 이름, 이메일, 전화번호, 소속, 비밀번호 재설정, 사용 중지/재개
export async function PATCH(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
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

    const authPatch: Record<string, unknown> = {}
    if (body.email && body.email.toLowerCase() !== String(target.email).toLowerCase()) {
      const other = await findAuthUserByEmail(ctx.db, body.email)
      if (other && other.id !== target.auth_user_id) throw new HttpError(409, '이미 사용 중인 이메일입니다.')
      authPatch.email = body.email
      authPatch.email_confirm = true
    }
    if (body.password) authPatch.password = body.password
    if (Object.keys(authPatch).length) {
      const { error } = await ctx.db.auth.admin.updateUserById(target.auth_user_id, authPatch)
      if (error) throw new HttpError(400, error.message)
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) patch.name = body.name
    if (body.email !== undefined) patch.email = body.email
    if (body.phone !== undefined) patch.phone = body.phone || null
    if (body.affiliationRoleId !== undefined) patch.affiliation_role_id = body.affiliationRoleId
    if (body.active !== undefined) patch.employment_status = body.active ? 'active' : 'inactive'
    const { error } = await ctx.db.from(TABLES.crmUsers).update(patch).eq('id', id)
    if (error) throw error

    await audit(ctx, 'update_user', 'crm_user', id, { ...patch, password_reset: Boolean(body.password) })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '계정 수정 실패')
  }
}
