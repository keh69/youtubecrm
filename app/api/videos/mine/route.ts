import { NextResponse } from 'next/server'
import { TABLES } from '@/lib/supabase/tables'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { VIDEO_FIELDS, toVideoDto } from '@/lib/crm/server/videos'
import { processReservations } from '@/lib/crm/server/reservations'

// 영상등록 화면 아래 영상 표: 내가 등록한 영상(최근 500개)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    await processReservations(ctx) // 공개된 예약 영상을 먼저 영상등록으로 옮긴다
    const { data, error } = await ctx.db
      .from(TABLES.videos)
      .select(VIDEO_FIELDS)
      .eq('primary_owner_user_id', ctx.profile.id)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    return NextResponse.json({ items: (data || []).map((r) => toVideoDto(r, ctx.profile.name)) })
  } catch (e) {
    return handleError(e, '내 영상 조회 실패')
  }
}
