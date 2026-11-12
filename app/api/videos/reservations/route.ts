import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { listMyReservations, reserveVideo } from '@/lib/crm/server/reservations'

// 영상등록 > 예약등록: 내 예약 목록(공개된 것은 이때 영상등록으로 옮겨진다)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    return NextResponse.json({ items: await listMyReservations(ctx) })
  } catch (e) {
    return handleError(e, '예약 목록 조회 실패')
  }
}

const bodySchema = z.object({
  stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(60, '종목명이 너무 길어요.'),
  youtubeUrl: z.string().trim().min(1, '유튜브 예약 링크를 입력해 주세요.'),
  contentType: z.enum(['longform', 'shortform']),
  scheduledAt: z.string().trim().max(40).optional().nullable() // 예약 공개 시각(참고용, ISO)
})

// 예약등록: 아직 비공개(예약)면 예약 목록에, 이미 공개된 영상이면 바로 영상등록에 넣는다
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    const body = bodySchema.parse(await request.json())
    const scheduledAt = body.scheduledAt && !Number.isNaN(Date.parse(body.scheduledAt)) ? new Date(body.scheduledAt).toISOString() : null
    return NextResponse.json({ ok: true, ...(await reserveVideo(ctx, { ...body, scheduledAt })) })
  } catch (e) {
    return handleError(e, '예약등록 실패')
  }
}
