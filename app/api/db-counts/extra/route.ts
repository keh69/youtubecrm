import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, isMissingSchema, requireMenu } from '@/lib/crm/server/context'
import { DB_EXTRA_HINT, DB_EXTRA_TAG_HINT, assertExtraEditable } from '@/lib/crm/server/db-counts'

// 디비입력 > 기타 이름(회원가입 안 한 사람). 데이터 저장용이라 통계에는 들어가지 않는다.
//  POST { name, tag? } → 추가(추가한 직원 = 나, 꼬리표 기본 '기타')
//  PATCH { id, name, tag } → 이름·꼬리표(기본 '기타') 고치기
//  DELETE ?id= → 이름과 그 사람의 DB 기록을 모두 지운다
const bodySchema = z.object({
  name: z.string().trim().min(1, '이름을 적어 주세요.').max(40, '이름은 40자까지 적을 수 있습니다.'),
  tag: z.string().trim().max(10, '꼬리표는 10자까지 적을 수 있습니다.').optional() // 비우면 '기타'
})

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'db_input')
    const body = bodySchema.parse(await request.json())
    const tag = body.tag || '기타'
    let { data, error } = await ctx.db.from(TABLES.dbExtraPeople).insert({ name: body.name, tag, owner_user_id: ctx.profile.id }).select('id, name, tag').single()
    if (error && isMissingSchema(error)) {
      // 꼬리표 칸이 아직 없는 DB(SQL 290 전): 꼬리표가 '기타'일 때만 이름만 넣는다
      if (tag !== '기타') throw new HttpError(409, DB_EXTRA_TAG_HINT)
      const r = await ctx.db.from(TABLES.dbExtraPeople).insert({ name: body.name, owner_user_id: ctx.profile.id }).select('id, name').single()
      data = r.data ? { ...(r.data as any), tag: '기타' } : null
      error = r.error
    }
    if (error) {
      if (isMissingSchema(error)) throw new HttpError(503, DB_EXTRA_HINT)
      throw error
    }
    return NextResponse.json({ ok: true, extra: data })
  } catch (e) {
    return handleError(e, '이름 추가 실패')
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, '이름을 적어 주세요.').max(40, '이름은 40자까지 적을 수 있습니다.'),
  tag: z.string().trim().min(1, '꼬리표를 적어 주세요(예: 기타).').max(10, '꼬리표는 10자까지 적을 수 있습니다.')
})

export async function PATCH(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'db_input')
    const body = patchSchema.parse(await request.json())
    await assertExtraEditable(ctx, body.id)
    let { data, error } = await ctx.db.from(TABLES.dbExtraPeople).update({ name: body.name, tag: body.tag }).eq('id', body.id).select('id, name, tag').single()
    if (error && isMissingSchema(error)) {
      // 꼬리표 칸이 아직 없으면(SQL 290 전) 꼬리표가 '기타'일 때만 이름만 고친다
      if (body.tag !== '기타') throw new HttpError(409, DB_EXTRA_TAG_HINT)
      const r = await ctx.db.from(TABLES.dbExtraPeople).update({ name: body.name }).eq('id', body.id).select('id, name').single()
      data = r.data ? { ...(r.data as any), tag: '기타' } : null
      error = r.error
    }
    if (error) throw error
    return NextResponse.json({ ok: true, extra: data })
  } catch (e) {
    return handleError(e, '이름 수정 실패')
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
