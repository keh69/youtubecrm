import { NextResponse } from 'next/server'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { cancelReservation } from '@/lib/crm/server/reservations'

type Params = { params: Promise<{ id: string }> }

// 예약 삭제(예약 목록에서만. 등록된 영상은 그대로)
export async function DELETE(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'videos')
    const { id } = await context.params
    await cancelReservation(ctx, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '예약 삭제 실패')
  }
}
