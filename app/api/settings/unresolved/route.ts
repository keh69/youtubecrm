import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getKstYmd } from '@/lib/attendance/time'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { requireSettingsTab } from '@/lib/crm/server/settings'
import { loadVisibleUsers } from '@/lib/crm/server/scope'
import { resolveDay, setAbsence } from '@/lib/crm/server/attendance'
import { loadUnresolved } from '@/lib/crm/server/unresolved'

// 설정 → 07 미처리: 출근미처리·퇴근미처리 목록 (?summary=1 이면 건수만: 상단 알림용)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'unresolved')
    const data = await loadUnresolved(ctx)
    if (new URL(request.url).searchParams.get('summary') === '1') {
      return NextResponse.json({ checkIn: data.checkIn.length, checkOut: data.checkOut.length })
    }
    return NextResponse.json(data)
  } catch (e) {
    return handleError(e, '미처리 조회 실패')
  }
}

// 미처리 처리: 출근 / 출근(지각) / 퇴근 / 퇴근(야근) / 결근 / 휴무 로 정하면 목록에서 사라진다.
const bodySchema = z.object({
  userId: z.string().uuid('잘못된 직원입니다.'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜가 올바르지 않습니다.'),
  action: z.enum(['in', 'in_late', 'out', 'out_overtime', 'absent', 'off']),
  time: z.string().regex(/^\d{2}:\d{2}$/, '시간을 09:00 처럼 적어 주세요.').nullable().optional(),
  note: z.string().trim().max(300).optional().default('')
})

export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'unresolved')
    const body = bodySchema.parse(await request.json())
    if (body.workDate > getKstYmd(new Date())) throw new HttpError(400, '앞으로의 날짜는 처리할 수 없습니다.')
    const person = (await loadVisibleUsers(ctx)).find((u) => u.id === body.userId && u.active)
    if (!person) throw new HttpError(403, '이 직원의 근태를 처리할 권한이 없습니다.')

    if (body.action === 'absent') await setAbsence(ctx, body.userId, body.workDate, body.note || '미처리 → 결근 처리')
    else await resolveDay(ctx, body.userId, body.workDate, body.action, body.time || null, body.note)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '미처리 처리 실패')
  }
}
