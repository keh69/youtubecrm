import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, type CrmContext } from '@/lib/crm/server/context'
import { VIDEO_FIELDS, toVideoDto } from '@/lib/crm/server/videos'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(60, '종목명이 너무 길어요.')
})

async function loadOwned(ctx: CrmContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 영상입니다.')
  const { data } = await ctx.db.from(TABLES.videos).select('id, primary_owner_user_id').eq('id', id).maybeSingle()
  if (!data) throw new HttpError(404, '영상을 찾을 수 없습니다.')
  if (data.primary_owner_user_id !== ctx.profile.id && !ctx.isAdmin) {
    throw new HttpError(403, '본인이 등록한 영상만 수정·삭제할 수 있습니다.')
  }
  return data
}

// 종목명 수정
export async function PATCH(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    const { id } = await context.params
    await loadOwned(ctx, id)
    const body = patchSchema.parse(await request.json())
    const { data, error } = await ctx.db
      .from(TABLES.videos)
      .update({ stock_name: body.stockName, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(VIDEO_FIELDS)
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, video: toVideoDto(data) })
  } catch (e) {
    return handleError(e, '영상 수정 실패')
  }
}

// 잘못 등록한 영상 삭제
export async function DELETE(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    const { id } = await context.params
    await loadOwned(ctx, id)
    const { error } = await ctx.db.from(TABLES.videos).delete().eq('id', id)
    if (error) throw error
    await ctx.db
      .from(TABLES.auditLogs)
      .insert({ actor_user_id: ctx.profile.id, action_type: 'delete_video', target_type: 'video', target_id: id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '영상 삭제 실패')
  }
}
