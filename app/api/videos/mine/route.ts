import { NextResponse } from 'next/server'
import { TABLES } from '@/lib/supabase/tables'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { VIDEO_FIELDS, loadChannelNames, toVideoDto } from '@/lib/crm/server/videos'
import { processReservations } from '@/lib/crm/server/reservations'

// 영상등록 화면 아래 영상리스트: 내가 등록한 영상(최근 500개).
// 총관리자는 예약등록처럼 모든 직원의 영상을 본다(예약해 둔 영상이 공개되면 등록자가 예약한 직원이라도 여기 나온다).
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    await processReservations(ctx) // 공개된 예약 영상을 먼저 영상등록으로 옮긴다
    let q = ctx.db.from(TABLES.videos).select(VIDEO_FIELDS)
    if (!ctx.isSuperAdmin) q = q.eq('primary_owner_user_id', ctx.profile.id)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
    if (error) throw error
    const rows = (data || []) as any[]
    // 담당자 이름 붙이기
    const names = new Map<string, string>([[ctx.profile.id, ctx.profile.name]])
    const others = [...new Set(rows.map((r) => r.primary_owner_user_id).filter((id) => id && !names.has(id)))]
    if (others.length) {
      const { data: users } = await ctx.db.from(TABLES.crmUsers).select('id, name').in('id', others)
      for (const u of users || []) names.set(u.id, u.name)
    }
    const channels = await loadChannelNames(ctx.db)
    return NextResponse.json({ items: rows.map((r) => toVideoDto(r, names.get(r.primary_owner_user_id) || undefined, channels.get(r.channel_id))) })
  } catch (e) {
    return handleError(e, '내 영상 조회 실패')
  }
}
