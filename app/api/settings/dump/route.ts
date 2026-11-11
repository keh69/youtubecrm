import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, loadRolesForUsers, type CrmContext } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { collectUnder, selectUserRows } from '@/lib/crm/server/scope'
import { displayLoginId, formerName, isDeletedRow } from '@/lib/crm/server/deleted'

// 설정 → 06 덤프파일: 삭제된 사원의 근태 기록·영상 기록을 보관해 두고 보는 곳.
// 총 관리자는 전체, 그 외에는 내 소속 하부였던 사원만.
async function loadScope(ctx: CrmContext) {
  const { rows } = await selectUserRows(ctx.db, 'id, name, login_id, role_type, custom_role_code, employment_status, updated_at', 'name')
  let mine: Set<string>
  if (ctx.isSuperAdmin) mine = new Set(rows.map((u) => u.id))
  else {
    const { rolesByUser } = await loadRolesForUsers(ctx.db, rows)
    mine = collectUnder(rows, rolesByUser, ctx.profile.id)
    mine.add(ctx.profile.id)
  }
  const deleted = rows.filter((u) => isDeletedRow(u) && mine.has(u.id))
  // 담당자로 고를 수 있는 사람: 내가 볼 수 있는 사용 중 아이디(나 포함)
  const assignees = rows.filter((u) => u.employment_status === 'active' && mine.has(u.id))
  return { deleted, assignees }
}

export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'dump')
    const { deleted, assignees } = await loadScope(ctx)
    const ids = deleted.map((u) => u.id)
    const nameOf = new Map(deleted.map((u) => [u.id, formerName(u.name)]))

    let attendance: any[] = []
    let videos: any[] = []
    if (ids.length) {
      const [att, vid] = await Promise.all([
        ctx.db
          .from(TABLES.attendanceDays)
          .select('user_id, work_date, check_in_at, check_out_at, attendance_status, absence_reason, worked_minutes')
          .in('user_id', ids)
          .order('work_date', { ascending: false })
          .limit(20000),
        ctx.db
          .from(TABLES.videos)
          .select('id, primary_owner_user_id, stock_name, title, youtube_video_id, published_at, created_at, view_count, duration_seconds, content_type')
          .in('primary_owner_user_id', ids)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(20000)
      ])
      if (att.error) throw att.error
      if (vid.error) throw vid.error
      attendance = (att.data || []).map((d: any) => ({
        userId: d.user_id,
        name: nameOf.get(d.user_id) || '-',
        workDate: d.work_date,
        checkInAt: d.check_in_at,
        checkOutAt: d.check_out_at,
        status: d.attendance_status,
        absenceReason: d.absence_reason,
        workedMinutes: d.worked_minutes || 0
      }))
      videos = (vid.data || []).map((v: any) => ({
        id: v.id,
        ownerId: v.primary_owner_user_id,
        ownerName: nameOf.get(v.primary_owner_user_id) || '-',
        stockName: v.stock_name,
        title: v.title || '(제목 없음)',
        url: `https://www.youtube.com/watch?v=${v.youtube_video_id}`,
        publishedAt: v.published_at,
        createdAt: v.created_at,
        viewCount: Number(v.view_count || 0),
        durationSeconds: v.duration_seconds,
        contentType: v.content_type
      }))
    }

    return NextResponse.json({
      people: deleted.map((u) => ({ id: u.id, name: formerName(u.name), loginId: displayLoginId(u.login_id), deletedAt: u.updated_at })),
      attendance,
      videos,
      assignees: assignees.map((u) => ({ id: u.id, name: u.name, loginId: u.login_id }))
    })
  } catch (e) {
    return handleError(e, '덤프파일 조회 실패')
  }
}

// 영상 담당자 변경: 고른 영상(삭제된 사원의 영상)을 사용 중인 다른 사원에게 넘긴다.
const reassignSchema = z.object({
  videoIds: z.array(z.string().uuid()).min(1, '영상을 하나 이상 골라 주세요.').max(5000),
  ownerId: z.string().uuid('새 담당자를 골라 주세요.')
})

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'dump')
    const body = reassignSchema.parse(await request.json())
    const { deleted, assignees } = await loadScope(ctx)
    const owner = assignees.find((u) => u.id === body.ownerId)
    if (!owner) throw new HttpError(403, '고른 담당자에게 넘길 수 없습니다.')

    const deletedIds = new Set(deleted.map((u) => u.id))
    const { data: rows, error } = await ctx.db.from(TABLES.videos).select('id, primary_owner_user_id').in('id', body.videoIds)
    if (error) throw error
    if ((rows || []).length !== new Set(body.videoIds).size || (rows || []).some((v: any) => !deletedIds.has(v.primary_owner_user_id))) {
      throw new HttpError(403, '삭제된 사원의 영상만 담당자를 바꿀 수 있습니다.')
    }
    const { error: upError } = await ctx.db
      .from(TABLES.videos)
      .update({ primary_owner_user_id: owner.id, updated_at: new Date().toISOString() })
      .in('id', body.videoIds)
    if (upError) throw upError
    await audit(ctx, 'reassign_videos', 'crm_user', owner.id, { count: body.videoIds.length, to: owner.name })
    return NextResponse.json({ ok: true, count: body.videoIds.length, ownerName: owner.name })
  } catch (e) {
    return handleError(e, '담당자 변경 실패')
  }
}
