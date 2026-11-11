import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getKstYmd } from '@/lib/attendance/time'
import { HttpError, getContext, handleError, requireMenu } from '@/lib/crm/server/context'
import { assertCanSeeUser } from '@/lib/crm/server/scope'
import { cancelAbsence, setAbsence } from '@/lib/crm/server/attendance'

const target = {
  userId: z.string().uuid('직원을 선택해 주세요.'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.')
}
const postSchema = z.object({ ...target, reason: z.string().trim().min(1, '결근 사유를 입력해 주세요.').max(300, '사유는 300자까지 쓸 수 있어요.') })
const deleteSchema = z.object(target)

// 결근 처리 (관리자/팀장 — '직원근태' 메뉴 권한 필요)
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance_team')
    const body = postSchema.parse(await request.json())
    if (body.workDate > getKstYmd(new Date())) throw new HttpError(400, '미래 날짜는 결근 처리할 수 없습니다.')
    await assertCanSeeUser(ctx, body.userId)
    return NextResponse.json({ ok: true, record: await setAbsence(ctx, body.userId, body.workDate, body.reason) })
  } catch (e) {
    return handleError(e, '결근 처리 실패')
  }
}

// 결근 취소
export async function DELETE(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'attendance_team')
    const body = deleteSchema.parse(await request.json())
    await assertCanSeeUser(ctx, body.userId)
    await cancelAbsence(ctx, body.userId, body.workDate)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '결근 취소 실패')
  }
}
