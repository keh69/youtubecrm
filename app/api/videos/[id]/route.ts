import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, type CrmContext } from '@/lib/crm/server/context'
import { VIDEO_FIELDS, toVideoDto } from '@/lib/crm/server/videos'
import { loadVisibleUsers } from '@/lib/crm/server/scope'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z
  .object({
    stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(60, '종목명이 너무 길어요.').optional(),
    contentType: z.enum(['longform', 'shortform']).optional() // 롱폼/숏폼
  })
  .refine((b) => b.stockName !== undefined || b.contentType !== undefined, '고칠 내용이 없습니다.')

// 누가 고치거나 지울 수 있나
// - 영상등록 '수정권한': 내가 등록한 영상
// - 영상통계 '수정권한': 영상통계에서 보이는 영상(영상통계 '관리자'면 모든 계정, 아니면 나와 내 소속 하부)
async function loadOwned(ctx: CrmContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 영상입니다.')
  const { data } = await ctx.db.from(TABLES.videos).select('id, primary_owner_user_id').eq('id', id).maybeSingle()
  if (!data) throw new HttpError(404, '영상을 찾을 수 없습니다.')
  if (data.primary_owner_user_id === ctx.profile.id && ctx.canEditVideos) return data
  if (ctx.canEditStatsVideos) {
    const people = await loadVisibleUsers(ctx, { all: ctx.canSeeAllStats })
    if (people.some((p) => p.id === data.primary_owner_user_id)) return data
  }
  throw new HttpError(403, '이 영상을 수정·삭제할 권한이 없습니다. 관리자에게 역할설정의 영상등록·영상통계 \'수정권한\'을 요청해 주세요.')
}

// 수정: 종목명·롱폼/숏폼
export async function PATCH(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    const { id } = await context.params
    await loadOwned(ctx, id)
    const body = patchSchema.parse(await request.json())
    const { data, error } = await ctx.db
      .from(TABLES.videos)
      .update({ ...(body.stockName !== undefined ? { stock_name: body.stockName } : {}), ...(body.contentType ? { content_type: body.contentType } : {}), updated_at: new Date().toISOString() })
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
