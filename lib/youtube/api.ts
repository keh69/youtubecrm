// 영상 길이로 형식을 자동으로 정한다. 10분(600초) 미만이면 숏폼, 그 이상이면 롱폼.
// 길이를 몰라(비공개 키·조회 실패) 알 수 없을 때만 등록 화면에서 넘긴 값을 그대로 쓴다.
export function deriveContentType(
  durationSeconds: number | null | undefined,
  fallback: 'longform' | 'shortform' = 'longform'
): 'longform' | 'shortform' {
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    return durationSeconds < 600 ? 'shortform' : 'longform'
  }
  return fallback
}

// 영상 제목에서 종목명을 자동으로 읽어낸다.
// 채널이 쓰는 두 가지 제목 양식을 알아본다: "[LS머트리얼즈 주가전망]" 또는 "LS머트리얼즈 주가전망 ...".
// 둘 다 아니면(다른 양식) null — 이때는 종목명 없이 등록하고 나중에 목록에서 고치면 된다.
export function extractStockNameFromTitle(title: string | null | undefined): string | null {
  if (!title) return null
  const text = title.trim()
  if (!text) return null

  // 1) 대괄호로 감싼 경우: 제목 어디에 있어도 찾는다(대괄호가 뚜렷한 표시라 오탐이 적다).
  const bracketed = /\[\s*([^[\]]{1,40}?)\s*주가\s*전망\s*\]/.exec(text)
  // 2) 대괄호 없이 맨 앞에 오는 경우: "LS머트리얼즈 주가전망 ..."
  const leading = bracketed ? null : /^([^[\]]{1,40}?)\s*주가\s*전망(?![가-힣a-zA-Z0-9])/.exec(text)

  const raw = bracketed?.[1] ?? leading?.[1]
  if (!raw) return null

  const name = raw.replace(/\s+/g, ' ').trim()
  return name.length > 0 && name.length <= 40 ? name : null
}

// 지원 형식: watch?v=ID, youtu.be/ID, /shorts/ID, /live/ID, /embed/ID (m., www., music. 포함)
export function extractYoutubeVideoId(input: string) {
  try {
    const url = new URL(input.trim())
    const host = url.hostname.toLowerCase()
    const valid = (id: string | undefined | null) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '')
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) return valid(url.pathname.split('/')[1])
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = valid(url.searchParams.get('v'))
      if (v) return v
      const [, kind, id] = url.pathname.split('/')
      if (['shorts', 'live', 'embed', 'v'].includes(kind)) return valid(id)
    }
    return ''
  } catch {
    return ''
  }
}

// 여러 영상의 최신 통계를 한 번에 가져온다(50개씩, 호출당 1 quota).
export async function fetchYoutubeStatsBatch(videoIds: string[], apiKey: string) {
  const result = new Map<
    string,
    { viewCount: number; likeCount: number; commentCount: number; durationSeconds: number | null; title: string; thumbnailUrl: string | null; publishedAt: string | null }
  >()
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&part=snippet,contentDetails,statistics&key=${apiKey}`,
      { cache: 'no-store' }
    )
    if (!response.ok) throw new Error(`YouTube API 오류 (${response.status})`)
    const json = (await response.json()) as { items?: any[] }
    for (const item of json.items || []) {
      const thumbs = item.snippet?.thumbnails || {}
      result.set(item.id, {
        viewCount: Number(item.statistics?.viewCount || 0),
        likeCount: Number(item.statistics?.likeCount || 0),
        commentCount: Number(item.statistics?.commentCount || 0),
        durationSeconds: item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null,
        title: item.snippet?.title || '',
        thumbnailUrl: thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || null,
        publishedAt: item.snippet?.publishedAt || null
      })
    }
  }
  return result
}

function parseIsoDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  const hour = Number(match[1] || 0)
  const minute = Number(match[2] || 0)
  const second = Number(match[3] || 0)
  return hour * 3600 + minute * 60 + second
}

export async function fetchYoutubeVideoMeta(youtubeUrl: string, apiKey: string) {
  const videoId = extractYoutubeVideoId(youtubeUrl)
  if (!videoId) {
    throw new Error('유효한 유튜브 영상 주소가 아닙니다.')
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics,status&key=${apiKey}`,
    { cache: 'no-store' }
  )

  const json = (await response.json()) as {
    items?: Array<{
      id: string
      snippet?: {
        title?: string
        description?: string
        publishedAt?: string
        channelId?: string
        channelTitle?: string
        thumbnails?: Record<string, { url: string }>
        liveBroadcastContent?: string
      }
      contentDetails?: { duration?: string }
      status?: { privacyStatus?: string }
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
    }>
  }

  const item = json.items?.[0]
  if (!item?.snippet) {
    throw new Error('유튜브 영상 메타데이터를 찾을 수 없습니다.')
  }

  return {
    youtubeVideoId: item.id,
    youtubeChannelId: item.snippet.channelId || '',
    channelName: item.snippet.channelTitle || '',
    title: item.snippet.title || '',
    description: item.snippet.description || '',
    publishedAt: item.snippet.publishedAt || null,
    durationSeconds: item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null,
    privacyStatus: item.status?.privacyStatus || null,
    // 'upcoming' = 최초 공개(프리미어) 예정. 아직 공개 전이다
    liveBroadcastContent: item.snippet.liveBroadcastContent || 'none',
    thumbnailUrl:
      item.snippet.thumbnails?.maxres?.url ||
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      null,
    viewCount: Number(item.statistics?.viewCount || 0),
    likeCount: Number(item.statistics?.likeCount || 0),
    commentCount: Number(item.statistics?.commentCount || 0)
  }
}
