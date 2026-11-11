import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getKstYmd } from '@/lib/attendance/time'
import { HttpError, getContext, handleError, requireMenu, type CrmContext } from '@/lib/crm/server/context'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { deleteDay, editDay } from '@/lib/crm/server/attendance'

// 근태통계 달력에서 하루 근태 고치기(PUT)·지우기(DELETE). 근태통계 메뉴 + 역할설정 '수정가능' 권한이 필요하다.
async function check(ctx: CrmContext, userId: string, workDate: string) {
  requireMenu(ctx, 'attendance_team')
  if (!ctx.canEditAttendance) throw new HttpError(403, '근태를 고칠 권한이 없습니다. 역할설정에서 근태통계 \'수정가능\'을 켜 주세요.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) throw new HttpError(400, '날짜가 올바르지 않습니다.')
  if (workDate > getKstYmd(new Date())) throw new HttpError(400, '앞으로의 날짜는 고칠 수 없습니다.')
  const person = (await loadVisibleUsers(ctx)).find((u) => u.id === userId)
  if (!person) throw new HttpError(403, '이 직원의 근태를 고칠 권한이 없습니다.')
}

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, '시간을 09:00 처럼 적어 주세요.').nullable().optional()
const putSchema = z.object({
  userId: z.string().uuid('잘못된 직원입니다.'),
  workDate: z.string(),
  kind: z.enum(['normal', 'absent', 'vacation']),
  checkIn: hhmm,
  checkOut: hhmm,
  reason: z.string().trim().max(300).optional().default('')
})

export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    const body = putSchema.parse(await request.json())
    await check(ctx, body.userId, body.workDate)
    const record = await editDay(ctx, body.userId, body.workDate, { kind: body.kind, checkIn: body.checkIn || null, checkOut: body.checkOut || null, reason: body.reason })
    return NextResponse.json({ ok: true, record })
  } catch (e) {
    return handleError(e, '근태 수정 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getContext(request)
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || ''
    const workDate = url.searchParams.get('workDate') || ''
    if (!z.string().uuid().safeParse(userId).success) throw new HttpError(400, '잘못된 직원입니다.')
    await check(ctx, userId, workDate)
    await deleteDay(ctx, userId, workDate)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '근태 삭제 실패')
  }
}
