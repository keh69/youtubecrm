import { NextResponse } from 'next/server'
import { TABLES } from '@/lib/supabase/tables'
import { addDaysToYmd, getKstYmd, getYmdList } from '@/lib/attendance/time'
import { HttpError, getContext, handleError, loadRolesForUsers, requireMenu } from '@/lib/crm/server/context'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { VIDEO_FIELDS, loadChannelNames, refreshStaleVideos, toVideoDto } from '@/lib/crm/server/videos'
import { processReservations } from '@/lib/crm/server/reservations'
import { loadDbCounts } from '@/lib/crm/server/db-counts'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 366

// 통계.
//  ?who=me (기본) | all (볼 수 있는 직원 전체) | <직원 id>
//  ?from=YYYY-MM-DD&to=YYYY-MM-DD (기본: 최근 30일, 업로드 날짜 기준)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    // 영상통계 또는 통계비교(같은 데이터를 두 번 불러 비교한다) 권한
    if (!ctx.menus.includes('stats_compare')) requireMenu(ctx, 'stats')
    const url = new URL(request.url)
    // 통계비교는 여러 번 동시에 부르므로 예약 옮기기는 건너뛴다(?sync=0)
    if (url.searchParams.get('sync') !== '0') await processReservations(ctx) // 공개된 예약 영상을 먼저 영상등록으로 옮긴다
    const today = getKstYmd(new Date())
    let to = url.searchParams.get('to') || today
    let from = url.searchParams.get('from') || addDaysToYmd(today, -29)
    if (!YMD.test(from) || !YMD.test(to)) throw new HttpError(400, '날짜 형식이 올바르지 않습니다.')
    if (from > to) [from, to] = [to, from]
    if (getYmdList(from, to).length > MAX_DAYS) from = addDaysToYmd(to, -(MAX_DAYS - 1))

    // 영상통계 범위: 역할설정 '관리자'가 켜져 있으면 모든 계정, 아니면 나와 내 소속 하부의 영상
    const people = ctx.canSeeAllStats ? await loadVisibleUsers(ctx, { all: true }) : await loadVisibleUsers(ctx)
    const who = url.searchParams.get('who') || 'me'
    let ids: string[]
    if (who === 'me') ids = [ctx.profile.id]
    else if (who === 'all') ids = people.map((p) => p.id)
    else if (people.some((p) => p.id === who)) ids = [who]
    else throw new HttpError(403, '이 직원의 통계를 볼 권한이 없습니다.')

    const nameById = new Map(people.map((p) => [p.id, p.name]))
    nameById.set(ctx.profile.id, ctx.profile.name)

    // 업로드 날짜(유튜브 게시일, 없으면 CRM 등록일)를 KST 날짜로 바꿔 기간을 거른다.
    const { data, error } = await ctx.db
      .from(TABLES.videos)
      .select(VIDEO_FIELDS)
      .in('primary_owner_user_id', ids)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(5000)
    if (error) throw error

    const dayOf = (row: any) => getKstYmd(new Date(row.published_at || row.created_at))
    const inRange = (data || []).filter((row) => {
      const d = dayOf(row)
      return d >= from && d <= to
    })
    const rows = await refreshStaleVideos(ctx.db, inRange)
    const channels = await loadChannelNames(ctx.db)
    const videos = rows.map((r) => toVideoDto(r, nameById.get(r.primary_owner_user_id), channels.get(r.channel_id)))

    const dayList = getYmdList(from, to)
    const daily = dayList.map((date) => {
      const list = rows.filter((r) => dayOf(r) === date)
      return { date, count: list.length, views: list.reduce((s, r) => s + Number(r.view_count || 0), 0) }
    })

    const sum = (list: typeof videos) => ({
      videoCount: list.length,
      totalViews: list.reduce((s, v) => s + v.viewCount, 0),
      totalDurationSeconds: list.reduce((s, v) => s + (v.durationSeconds || 0), 0)
    })

    // 담당자별 표에서는 총 관리자(admin)를 뺀다(영상을 올리는 직원만)
    const { rolesByUser } = await loadRolesForUsers(ctx.db, ids.map((id) => ({ id, role_type: '', custom_role_code: null }) as any))
    const personIds = ids.filter((id) => !(rolesByUser.get(id) || []).some((r) => r.code === LOCKED_ROLE_CODE))
    const perPerson =
      ids.length > 1
        ? personIds
            .map((id) => ({ userId: id, name: nameById.get(id) || '-', ...sum(videos.filter((v) => v.ownerId === id)) }))
            .sort((a, b) => b.totalViews - a.totalViews || b.videoCount - a.videoCount)
        : []

    // 디비입력에서 적은 DB 개수(같은 직원·같은 기간). 표가 아직 없으면 ready=false
    const dbc = await loadDbCounts(ctx.db, ids, from, to)
    const dbDaily = new Map<string, number>()
    const dbByUser = new Map<string, number>()
    for (const r of dbc.rows) {
      dbDaily.set(r.date, (dbDaily.get(r.date) || 0) + r.count)
      dbByUser.set(r.userId, (dbByUser.get(r.userId) || 0) + r.count)
    }
    const db = {
      ready: dbc.ready,
      total: dbc.rows.reduce((s, r) => s + r.count, 0),
      daily: dayList.map((date) => ({ date, count: dbDaily.get(date) || 0 })),
      perPerson: [...dbByUser].map(([userId, count]) => ({ userId, count }))
    }

    return NextResponse.json({
      db,
      from,
      to,
      who,
      people: people.map((p) => ({ id: p.id, name: p.name, loginId: p.loginId, affiliationName: p.affiliationName })),
      summary: sum(videos),
      daily,
      perPerson,
      videos
    })
  } catch (e) {
    return handleError(e, '통계 조회 실패')
  }
}
