import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { registerVideo } from '@/lib/crm/server/videos'

const bodySchema = z.object({
  stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(60, '종목명이 너무 길어요.'),
  youtubeUrl: z.string().trim().min(1, '유튜브 영상 주소를 입력해 주세요.'),
  // 롱폼/숏폼(등록 화면에서 고름). 예전 화면처럼 안 보내면 길이로 정한다.
  contentType: z.enum(['longform', 'shortform']).optional()
})

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    const body = bodySchema.parse(await request.json())
    return NextResponse.json({ ok: true, ...(await registerVideo(ctx, body.youtubeUrl, body.stockName, body.contentType)) })
  } catch (e) {
    return handleError(e, '영상 등록 실패')
  }
}
