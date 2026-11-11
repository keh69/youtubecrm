import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getKstYmd } from '@/lib/attendance/time'
import { HttpError, getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { assertCanSeeUser } from '@/lib/crm/server/scope'
import { applyDay } from '@/lib/crm/server/attendance'

const bodySchema = z.object({
  userId: z.string().uuid('직원을 선택해 주세요.'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
  action: z.enum(['in', 'in_late', 'out', 'out_overtime']),
  time: z.string().regex(/^\d{2}:\d{2}$/, '시간을 09:00 처럼 적어 주세요.')
})

// 근태통계 > 근태처리: 출근 / 출근(지각) / 퇴근 / 퇴근(야근) 바로 적용 (이미 기록이 있으면 거절)
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance_team')
    const body = bodySchema.parse(await request.json())
    if (body.workDate > getKstYmd(new Date())) throw new HttpError(400, '앞으로의 날짜는 처리할 수 없습니다.')
    await assertCanSeeUser(ctx, body.userId)
    return NextResponse.json({ ok: true, record: await applyDay(ctx, body.userId, body.workDate, body.action, body.time) })
  } catch (e) {
    return handleError(e, '근태처리 실패')
  }
}
