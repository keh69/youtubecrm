import { NextResponse } from 'next/server'
import { getContext, handleError } from '@/lib/crm/server/context'
import { requireSettings } from '@/lib/crm/server/settings'
import { loadSubordinates } from '@/lib/crm/server/scope'

// 설정 → 01 사원목록: 내 소속 하부에 있는 사원만(나 제외).
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    return NextResponse.json({ items: await loadSubordinates(ctx) })
  } catch (e) {
    return handleError(e, '사원 목록 조회 실패')
  }
}
