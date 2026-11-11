import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getContext, handleError } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { getWorkHours } from '@/lib/attendance/time'
import { saveWorkHours } from '@/lib/crm/server/work-hours'

// 설정 → 08 출퇴근시간: 지각(출근 기준시간 이후 출근)·야근(퇴근 기준시간 이후 퇴근) 기준
export async function GET(request: Request) {
  try {
    await getContext(request) // 로그인한 사람이면 누구나 기준시간을 볼 수 있다(getContext 가 최신 값으로 맞춘다)
    return NextResponse.json(getWorkHours())
  } catch (e) {
    return handleError(e, '출퇴근시간 조회 실패')
  }
}

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '시간을 10:00 처럼 적어 주세요.')
const bodySchema = z.object({ start: hm, end: hm })

export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'workhours')
    const body = bodySchema.parse(await request.json())
    const before = getWorkHours()
    const saved = await saveWorkHours(ctx.db, body)
    await audit(ctx, 'set_work_hours', 'app_settings', null, { before, after: saved })
    return NextResponse.json(saved)
  } catch (e) {
    return handleError(e, '출퇴근시간 저장 실패')
  }
}
