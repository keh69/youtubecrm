import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { passwordSchema, signInCompat, toAuthPassword } from '@/lib/crm/server/password'

const bodySchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해 주세요.'),
  newPassword: passwordSchema
})

// 내정보 → 비밀번호 변경. 현재 비밀번호가 맞아야 바꿀 수 있다(모든 로그인 사용자 가능, 메뉴 권한 무관).
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    const body = bodySchema.parse(await request.json())
    if (body.currentPassword === body.newPassword) throw new HttpError(400, '새 비밀번호가 현재 비밀번호와 같습니다.')

    const check = await signInCompat(ctx.profile.email, body.currentPassword)
    if (!check?.user) throw new HttpError(400, '현재 비밀번호가 맞지 않습니다.')

    const { error } = await ctx.db.auth.admin.updateUserById(check.user.id, { password: toAuthPassword(body.newPassword) })
    if (error) throw new HttpError(400, error.message)

    await ctx.db.from(TABLES.auditLogs).insert({
      actor_user_id: ctx.profile.id,
      action_type: 'change_own_password',
      target_type: 'crm_user',
      target_id: ctx.profile.id
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '비밀번호 변경 실패')
  }
}
