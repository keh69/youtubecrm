import { TABLES } from '@/lib/supabase/tables'
import { deriveContentType, extractYoutubeVideoId, fetchYoutubeStatsBatch, fetchYoutubeVideoMeta } from '@/lib/youtube/api'
import { getActiveYoutubeKey } from '@/lib/youtube/default-account'
import { HttpError, type Admin, type CrmContext } from '@/lib/crm/server/context'

export const VIDEO_FIELDS =
  'id, youtube_video_id, youtube_url, stock_name, title, thumbnail_url, view_count, like_count, comment_count, duration_seconds, published_at, created_at, content_type, primary_owner_user_id, last_synced_at'

export type VideoDto = {
  id: string
  youtubeVideoId: string
  url: string
  stockName: string
  title: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number | null
  publishedAt: string | null
  createdAt: string
  contentType: 'longform' | 'shortform'
  ownerId: string
  ownerName?: string
}

export function toVideoDto(row: any, ownerName?: string): VideoDto {
  return {
    id: row.id,
    youtubeVideoId: row.youtube_video_id,
    url: `https://www.youtube.com/watch?v=${row.youtube_video_id}`,
    stockName: row.stock_name,
    title: row.title || '(제목 없음)',
    thumbnailUrl: row.thumbnail_url || `https://i.ytimg.com/vi/${row.youtube_video_id}/hqdefault.jpg`,
    viewCount: Number(row.view_count || 0),
    likeCount: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || 0),
    durationSeconds: row.duration_seconds ?? null,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    contentType: row.content_type,
    ownerId: row.primary_owner_user_id,
    ownerName
  }
}

// contentType: 등록할 때 고른 롱폼/숏폼. 없으면(예전 화면) 길이로 정한다.
export async function registerVideo(ctx: CrmContext, youtubeUrl: string, stockName: string, contentType?: 'longform' | 'shortform') {
  const { db, profile } = ctx
  const videoId = extractYoutubeVideoId(youtubeUrl)
  if (!videoId) throw new HttpError(400, '유튜브 영상 주소가 올바르지 않습니다. (예: https://youtu.be/영상ID)')

  const { data: existing } = await db.from(TABLES.videos).select('id, primary_owner_user_id').eq('youtube_video_id', videoId).maybeSingle()
  if (existing && existing.primary_owner_user_id !== profile.id) {
    const { data: owner } = await db.from(TABLES.crmUsers).select('name').eq('id', existing.primary_owner_user_id).maybeSingle()
    throw new HttpError(409, `이미 ${owner?.name || '다른 직원'}님이 등록한 영상입니다.`)
  }

  const { account, apiKey } = await getActiveYoutubeKey(db)
  if (!apiKey) throw new HttpError(503, 'YouTube API 연결이 꺼져 있습니다. 관리자에게 문의해 주세요.')
  let meta: Awaited<ReturnType<typeof fetchYoutubeVideoMeta>>
  try {
    meta = await fetchYoutubeVideoMeta(`https://www.youtube.com/watch?v=${videoId}`, apiKey)
  } catch {
    throw new HttpError(404, '유튜브에서 영상을 찾을 수 없습니다. 주소와 공개 상태를 확인해 주세요.')
  }

  const { data: channel } = await db.from(TABLES.channels).select('id').eq('youtube_channel_id', meta.youtubeChannelId).maybeSingle()
  let channelId = channel?.id as string | undefined
  if (!channelId) {
    const { data: created, error } = await db
      .from(TABLES.channels)
      .insert({ youtube_channel_id: meta.youtubeChannelId, name: meta.channelName || meta.youtubeChannelId, status: 'active', is_active: true })
      .select('id')
      .single()
    if (error || !created) throw error || new Error('채널 생성 실패')
    channelId = created.id as string
  }

  const nowIso = new Date().toISOString()
  const { data: saved, error: saveError } = await db
    .from(TABLES.videos)
    .upsert(
      {
        youtube_video_id: meta.youtubeVideoId,
        youtube_account_id: account.id,
        channel_id: channelId,
        primary_owner_user_id: profile.id,
        youtube_url: youtubeUrl.trim(),
        content_type: contentType || deriveContentType(meta.durationSeconds, 'longform'),
        stock_name: stockName,
        publish_state: 'published',
        title: meta.title || null,
        description: meta.description || null,
        privacy_status: meta.privacyStatus,
        published_at: meta.publishedAt,
        duration_seconds: meta.durationSeconds,
        thumbnail_url: meta.thumbnailUrl,
        view_count: meta.viewCount,
        like_count: meta.likeCount,
        comment_count: meta.commentCount,
        last_synced_at: nowIso,
        updated_at: nowIso
      },
      { onConflict: 'youtube_video_id' }
    )
    .select(VIDEO_FIELDS)
    .single()
  if (saveError || !saved) throw saveError || new Error('영상 저장 실패')

  await db.from(TABLES.videoSnapshots).insert({
    video_id: saved.id,
    snapshot_at: nowIso,
    view_count: meta.viewCount,
    like_count: meta.likeCount,
    comment_count: meta.commentCount,
    privacy_status: meta.privacyStatus,
    raw_json: meta
  })
  await db.from(TABLES.workActivityEvents).insert({
    user_id: profile.id,
    activity_type: 'video_registered',
    related_channel_id: channelId,
    related_video_id: saved.id,
    payload_summary: { youtube_video_id: meta.youtubeVideoId, stock_name: stockName }
  })

  return { video: toVideoDto(saved, profile.name), updated: Boolean(existing) }
}

const STALE_MS = 30 * 60 * 1000
const MAX_REFRESH = 200

// 30분 넘게 갱신 안 된 영상의 조회수 등을 YouTube에서 다시 가져와 저장한다(통계 화면 열 때).
export async function refreshStaleVideos(db: Admin, rows: any[]) {
  const stale = rows
    .filter((r) => !r.last_synced_at || Date.now() - new Date(r.last_synced_at).getTime() > STALE_MS)
    .slice(0, MAX_REFRESH)
  if (stale.length === 0) return rows
  let apiKey: string | null = null
  try {
    apiKey = (await getActiveYoutubeKey(db)).apiKey
  } catch {
    apiKey = null
  }
  if (!apiKey) return rows
  let stats: Awaited<ReturnType<typeof fetchYoutubeStatsBatch>>
  try {
    stats = await fetchYoutubeStatsBatch(stale.map((r) => r.youtube_video_id), apiKey)
  } catch (e) {
    console.error('YouTube 통계 갱신 실패', e)
    return rows
  }
  const nowIso = new Date().toISOString()
  const updatedById = new Map<string, any>()
  await Promise.all(
    stale.map(async (r) => {
      const s = stats.get(r.youtube_video_id)
      if (!s) return
      const patch = {
        view_count: s.viewCount,
        like_count: s.likeCount,
        comment_count: s.commentCount,
        duration_seconds: s.durationSeconds ?? r.duration_seconds,
        title: s.title || r.title,
        thumbnail_url: s.thumbnailUrl || r.thumbnail_url,
        published_at: s.publishedAt || r.published_at,
        last_synced_at: nowIso
      }
      await db.from(TABLES.videos).update(patch).eq('id', r.id)
      updatedById.set(r.id, { ...r, ...patch })
    })
  )
  return rows.map((r) => updatedById.get(r.id) || r)
}
