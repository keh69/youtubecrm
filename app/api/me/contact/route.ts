import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { audit, publicEmail } from '@/lib/crm/server/settings'
import { phoneSchema } from '@/lib/crm/server/accounts'

// 내정보: 내 전화번호·이메일 보기(GET)와 고치기(PUT). 전화번호는 숫자만 저장한다.
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    const { data } = await ctx.db.from(TABLES.crmUsers).select('email, phone').eq('id', ctx.profile.id).maybeSingle()
    return NextResponse.json({ email: publicEmail(data?.email), phone: String(data?.phone || '').replace(/[^0-9]/g, '') })
  } catch (e) {
    return handleError(e, '내 정보 조회 실패')
  }
}

const bodySchema = z.object({
  // 비우면 이메일은 그대로 둔다(이메일 없이 만든 계정은 내부용 주소를 쓰기 때문)
  email: z.union([z.literal(''), z.string().trim().email('이메일 형식이 올바르지 않습니다.')]).optional().default(''),
  phone: phoneSchema
})

export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    const body = bodySchema.parse(await request.json())
    const { data: me } = await ctx.db.from(TABLES.crmUsers).select('id, auth_user_id, email').eq('id', ctx.profile.id).single()
    if (!me) throw new HttpError(404, '내 계정을 찾을 수 없습니다.')

    const patch: Record<string, unknown> = { phone: body.phone || null, updated_at: new Date().toISOString() }
    if (body.email && body.email.toLowerCase() !== String(me.email).toLowerCase()) {
      const other = await findAuthUserByEmail(ctx.db, body.email)
      if (other && other.id !== me.auth_user_id) throw new HttpError(409, '이미 사용 중인 이메일입니다.')
      const { error } = await ctx.db.auth.admin.updateUserById(me.auth_user_id, { email: body.email, email_confirm: true })
      if (error) throw new HttpError(400, error.message)
      patch.email = body.email
    }
    const { error } = await ctx.db.from(TABLES.crmUsers).update(patch).eq('id', me.id)
    if (error) throw error
    await audit(ctx, 'edit_my_contact', 'crm_user', me.id, { phone: body.phone, email_changed: Boolean(patch.email) })
    return NextResponse.json({ ok: true, email: publicEmail(String(patch.email || me.email)), phone: body.phone })
  } catch (e) {
    return handleError(e, '내 정보 저장 실패')
  }
}
