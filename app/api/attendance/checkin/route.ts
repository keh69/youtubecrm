import { NextResponse } from 'next/server'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { assertDesktop } from '@/lib/crm/server/device'
import { checkIn } from '@/lib/crm/server/attendance'

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance')
    // 출근·퇴근은 컴퓨터에서만(폰·태블릿이면 거절)
    const body = await request.json().catch(() => ({}))
    assertDesktop(request, body?.device === 'mobile')
    return NextResponse.json({ ok: true, record: await checkIn(ctx) })
  } catch (e) {
    return handleError(e, '출근 처리 실패')
  }
}
