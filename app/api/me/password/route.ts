import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { passwordSchema, toAuthPassword } from '@/lib/crm/server/password'

const bodySchema = z.object({
  newPassword: passwordSchema
})

// 내정보 → 비밀번호 변경. 로그인한 상태라면 현재 비밀번호 없이 바로 바꾼다(모든 로그인 사용자 가능, 메뉴 권한 무관).
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    const body = bodySchema.parse(await request.json())

    const { data: row } = await ctx.db.from(TABLES.crmUsers).select('auth_user_id').eq('id', ctx.profile.id).single()
    if (!row?.auth_user_id) throw new HttpError(404, '계정을 찾을 수 없습니다.')

    const { error } = await ctx.db.auth.admin.updateUserById(row.auth_user_id, { password: toAuthPassword(body.newPassword) })
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
