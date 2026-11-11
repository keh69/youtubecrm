import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { SKINS } from '@/lib/crm/skins'
import { getContext, handleError } from '@/lib/crm/server/context'

const bodySchema = z.object({
  skin: z.enum(SKINS.map((s) => s.key) as [string, ...string[]], { message: '없는 스킨입니다.' })
})

// 스킨 메뉴: 내가 고른 스킨을 내 아이디에 저장한다(다음 로그인부터 그 스킨으로 열린다).
export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    const body = bodySchema.parse(await request.json())
    const { error } = await ctx.db.from(TABLES.crmUsers).update({ skin: body.skin, updated_at: new Date().toISOString() }).eq('id', ctx.profile.id)
    if (error) throw error
    return NextResponse.json({ ok: true, skin: body.skin })
  } catch (e) {
    return handleError(e, '스킨 저장 실패')
  }
}
