import type { Video } from '@/lib/crm/client/types'

// 영상을 올린 유튜브 채널별로 묶는다. 채널 이름 가나다순, 색 차례(tone 0~3)도 여기서 정해
// 영상리스트의 '채널' 꼬리표와 영상통계의 채널별 줄이 같은 색을 쓰게 한다.
export const NO_CHANNEL = '채널 미확인'

export type ChannelGroup = { name: string; tone: number; videos: Video[] }

export function channelGroups(videos: Video[]): ChannelGroup[] {
  const nameOf = (v: Video) => v.channelName || NO_CHANNEL
  const names = [...new Set(videos.map(nameOf))].sort((a, b) => (a === NO_CHANNEL ? 1 : b === NO_CHANNEL ? -1 : a.localeCompare(b, 'ko')))
  return names.map((name, i) => ({ name, tone: i % 4, videos: videos.filter((v) => nameOf(v) === name) }))
}

// 한국 날짜(YYYY-MM-DD). 서버 일자별 표와 같은 기준: 유튜브 게시일, 없으면 CRM 등록일
const kstFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
export const uploadedKstYmd = (v: Video) => kstFmt.format(new Date(v.publishedAt || v.createdAt))
