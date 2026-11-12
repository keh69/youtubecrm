import { TABLES } from '@/lib/supabase/tables'
import { extractYoutubeVideoId, fetchYoutubeVideoMeta } from '@/lib/youtube/api'
import { getActiveYoutubeKey } from '@/lib/youtube/default-account'
import { HttpError, type CrmContext } from '@/lib/crm/server/context'
import { registerVideo } from '@/lib/crm/server/videos'

// ───────── 영상 예약등록 ─────────
// 유튜브에 '예약' 업로드한 영상은 공개 전까지 비공개라 YouTube API 로 보이지 않는다.
// 그래서 링크·종목명·폼종류를 예약 목록에 저장해 두고, 영상이 공개되면(API 에 보이면) 자동으로 영상등록으로 옮긴다.
// 확인 시점: 영상등록·영상통계 화면을 누군가 열 때(1분에 한 번까지). 공개 시각이 지나고 처음 화면을 열 때 옮겨진다.
// 옮길 때 '올린 날짜'는 유튜브의 실제 공개 시각이 들어간다.

export type ReservationDto = {
  id: string
  youtubeVideoId: string
  url: string
  stockName: string
  contentType: 'longform' | 'shortform'
  scheduledAt: string | null
  status: 'waiting' | 'registered'
  createdAt: string
  registeredAt: string | null
  lastCheckedAt: string | null
  videoId: string | null
  ownerUserId: string
  ownerName: string | null
}

const FIELDS = 'id, youtube_video_id, youtube_url, stock_name, content_type, owner_user_id, scheduled_at, status, video_id, last_checked_at, registered_at, created_at'

function toDto(r: any, ownerName: string | null = null): ReservationDto {
  return {
    id: r.id,
    youtubeVideoId: r.youtube_video_id,
    url: `https://youtu.be/${r.youtube_video_id}`,
    stockName: r.stock_name,
    contentType: r.content_type,
    scheduledAt: r.scheduled_at || null,
    status: r.status,
    createdAt: r.created_at,
    registeredAt: r.registered_at || null,
    lastCheckedAt: r.last_checked_at || null,
    videoId: r.video_id || null,
    ownerUserId: r.owner_user_id,
    ownerName
  }
}

// 260 SQL 을 아직 안 돌렸으면 알아보기 쉬운 안내로 바꾼다
function tableError(e: any): never {
  const text = `${e?.code || ''} ${e?.message || ''}`
  if (/42P01|PGRST205|video_reservations/.test(text)) {
    throw new HttpError(503, 'DB 업데이트가 필요합니다. supabase/sql/simple/260_video_reservations.sql 을 Supabase SQL Editor 에서 실행해 주세요.')
  }
  throw e
}

// 유튜브에서 지금 볼 수 있는(공개·일부공개, 최초 공개 대기 아님) 영상 id 들
async function fetchLiveIds(ids: string[], apiKey: string) {
  const live = new Set<string>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&part=snippet,status&key=${apiKey}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`YouTube API 오류 (${res.status})`)
    const json = (await res.json()) as { items?: Array<{ id: string; snippet?: { liveBroadcastContent?: string }; status?: { privacyStatus?: string } }> }
    for (const it of json.items || []) {
      if (it.status?.privacyStatus === 'private') continue
      if (it.snippet?.liveBroadcastContent === 'upcoming') continue
      live.add(it.id)
    }
  }
  return live
}

// 예약 하나를 영상등록으로 옮긴다(등록자는 예약한 직원)
async function convert(ctx: CrmContext, r: any) {
  const { db } = ctx
  const { data: owner } = await db.from(TABLES.crmUsers).select('id, name').eq('id', r.owner_user_id).maybeSingle()
  let videoId: string | null = null
  try {
    if (!owner) throw new Error('예약한 직원 없음')
    const ownerCtx = { ...ctx, profile: { ...ctx.profile, id: owner.id, name: owner.name } } as CrmContext
    const out = await registerVideo(ownerCtx, `https://www.youtube.com/watch?v=${r.youtube_video_id}`, r.stock_name, r.content_type)
    videoId = out.video.id
  } catch {
    // 그사이 누군가 같은 영상을 직접 등록했으면 그 영상에 연결하고 예약은 끝낸다
    const { data: existing } = await db.from(TABLES.videos).select('id').eq('youtube_video_id', r.youtube_video_id).maybeSingle()
    if (!existing) return false
    videoId = existing.id
  }
  const nowIso = new Date().toISOString()
  await db.from(TABLES.videoReservations).update({ status: 'registered', video_id: videoId, registered_at: nowIso, last_checked_at: nowIso }).eq('id', r.id)
  return true
}

let lastRun = 0
// 공개된 예약 영상을 찾아 영상등록으로 옮긴다. force 가 아니면 1분에 한 번까지만.
export async function processReservations(ctx: CrmContext, force = false) {
  const now = Date.now()
  if (!force && now - lastRun < 60_000) return 0
  lastRun = now
  try {
    const { db } = ctx
    const { data, error } = await db.from(TABLES.videoReservations).select(FIELDS).eq('status', 'waiting').order('created_at').limit(200)
    if (error || !data || data.length === 0) return 0
    const { apiKey } = await getActiveYoutubeKey(db)
    if (!apiKey) return 0
    const live = await fetchLiveIds(data.map((r: any) => r.youtube_video_id), apiKey)
    let moved = 0
    for (const r of data as any[]) if (live.has(r.youtube_video_id) && (await convert(ctx, r))) moved++
    const notYet = (data as any[]).filter((r) => !live.has(r.youtube_video_id)).map((r) => r.id)
    if (notYet.length) await db.from(TABLES.videoReservations).update({ last_checked_at: new Date().toISOString() }).in('id', notYet)
    return moved
  } catch {
    return 0 // 확인 실패는 화면을 막지 않는다(다음에 다시 확인)
  }
}

// 예약 등록. 이미 공개된 영상이면 바로 영상등록으로 넣는다.
export async function reserveVideo(ctx: CrmContext, input: { youtubeUrl: string; stockName: string; contentType: 'longform' | 'shortform'; scheduledAt?: string | null }) {
  const { db, profile } = ctx
  const videoId = extractYoutubeVideoId(input.youtubeUrl)
  if (!videoId) throw new HttpError(400, '유튜브 예약 링크가 올바르지 않습니다. (예: https://youtu.be/영상ID)')

  const { data: video } = await db.from(TABLES.videos).select('id').eq('youtube_video_id', videoId).maybeSingle()
  if (video) throw new HttpError(409, '이미 영상등록에 있는 영상입니다.')
  const { data: dup, error: dupError } = await db.from(TABLES.videoReservations).select('id, status').eq('youtube_video_id', videoId).maybeSingle()
  if (dupError) tableError(dupError)
  if (dup) throw new HttpError(409, '이미 예약등록된 영상입니다.')

  // 벌써 공개된 영상이면 예약할 필요 없이 바로 등록
  const { apiKey } = await getActiveYoutubeKey(db)
  if (apiKey) {
    const meta = await fetchYoutubeVideoMeta(`https://www.youtube.com/watch?v=${videoId}`, apiKey).catch(() => null)
    if (meta && meta.privacyStatus !== 'private' && meta.liveBroadcastContent !== 'upcoming') {
      const out = await registerVideo(ctx, input.youtubeUrl, input.stockName, input.contentType)
      return { registered: true as const, video: out.video }
    }
  }

  const { data, error } = await db
    .from(TABLES.videoReservations)
    .insert({
      youtube_video_id: videoId,
      youtube_url: input.youtubeUrl.trim(),
      stock_name: input.stockName,
      content_type: input.contentType,
      owner_user_id: profile.id,
      scheduled_at: input.scheduledAt || null
    })
    .select(FIELDS)
    .single()
  if (error || !data) tableError(error)
  return { registered: false as const, reservation: toDto(data) }
}

// 예약 목록(공개 대기 중 + 최근 옮겨진 것 30일). 보통은 내 것만, 총관리자는 모든 직원 것.
export async function listMyReservations(ctx: CrmContext) {
  await processReservations(ctx)
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  let q = ctx.db.from(TABLES.videoReservations).select(FIELDS)
  if (!ctx.isSuperAdmin) q = q.eq('owner_user_id', ctx.profile.id)
  const { data, error } = await q
    .or(`status.eq.waiting,registered_at.gte.${since}`)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) tableError(error)
  const rows = (data || []) as any[]
  // 등록자 이름 붙이기
  const ids = [...new Set(rows.map((r) => r.owner_user_id))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: users } = await ctx.db.from(TABLES.crmUsers).select('id, name').in('id', ids)
    for (const u of users || []) names.set(u.id, u.name)
  }
  return rows.map((r) => toDto(r, names.get(r.owner_user_id) || null))
}

// 예약 삭제(예약 목록에서만 지운다. 이미 등록된 영상은 그대로). 본인 것, 또는 영상등록 수정권한이 있으면 남의 것도.
export async function cancelReservation(ctx: CrmContext, id: string) {
  const { data, error } = await ctx.db.from(TABLES.videoReservations).select('id, owner_user_id, status').eq('id', id).maybeSingle()
  if (error) tableError(error)
  if (!data) throw new HttpError(404, '예약을 찾을 수 없습니다.')
  if (data.owner_user_id !== ctx.profile.id && !ctx.canEditVideos) throw new HttpError(403, '내가 예약한 영상만 삭제할 수 있습니다.')
  const { error: delError } = await ctx.db.from(TABLES.videoReservations).delete().eq('id', id)
  if (delError) throw delError
}
