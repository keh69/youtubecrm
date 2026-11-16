import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, isMissingSchema, requireMenu } from '@/lib/crm/server/context'
import { DB_EXTRA_HINT, assertExtraEditable } from '@/lib/crm/server/db-counts'

// 디비입력 > 기타 이름(회원가입 안 한 사람). 데이터 저장용이라 통계에는 들어가지 않는다.
//  POST { name } → 추가(추가한 직원 = 나)
//  DELETE ?id= → 이름과 그 사람의 DB 기록을 모두 지운다
const bodySchema = z.object({ name: z.string().trim().min(1, '이름을 적어 주세요.').max(40, '이름은 40자까지 적을 수 있습니다.') })

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'db_input')
    const body = bodySchema.parse(await request.json())
    const { data, error } = await ctx.db.from(TABLES.dbExtraPeople).insert({ name: body.name, owner_user_id: ctx.profile.id }).select('id, name').single()
    if (error) {
      if (isMissingSchema(error)) throw new HttpError(503, DB_EXTRA_HINT)
      throw error
    }
    return NextResponse.json({ ok: true, extra: data })
  } catch (e) {
    return handleError(e, '이름 추가 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'db_input')
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '지울 이름을 알 수 없습니다.')
    await assertExtraEditable(ctx, id)
    const { error } = await ctx.db.from(TABLES.dbExtraPeople).delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '이름 삭제 실패')
  }
}
