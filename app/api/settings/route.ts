import { NextResponse } from 'next/server'
import { getContext, handleError } from '@/lib/crm/server/context'
import { loadSettingsOverview, requireSettings } from '@/lib/crm/server/settings'

// 설정 화면 데이터: 역할 목록(+메뉴 권한), 계정 목록(+역할, 소속)
export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    return NextResponse.json(await loadSettingsOverview(ctx))
  } catch (e) {
    return handleError(e, '설정 조회 실패')
  }
}
