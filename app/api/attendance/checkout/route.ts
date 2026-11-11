import { NextResponse } from 'next/server'
import { getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { checkOut } from '@/lib/crm/server/attendance'

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance')
    return NextResponse.json({ ok: true, record: await checkOut(ctx) })
  } catch (e) {
    return handleError(e, '퇴근 처리 실패')
  }
}
