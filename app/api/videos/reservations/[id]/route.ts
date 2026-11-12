import { NextResponse } from 'next/server'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { cancelReservation } from '@/lib/crm/server/reservations'

type Params = { params: Promise<{ id: string }> }

// 예약 취소(공개 대기 중인 것만)
export async function DELETE(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    const { id } = await context.params
    await cancelReservation(ctx, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '예약 취소 실패')
  }
}
