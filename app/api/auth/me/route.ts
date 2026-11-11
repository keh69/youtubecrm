import { NextResponse } from 'next/server'
import { getContext, handleError } from '@/lib/crm/server/context'

export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    return NextResponse.json({
      id: ctx.profile.id,
      name: ctx.profile.name,
      loginId: ctx.profile.login_id,
      roles: ctx.roles.map((r) => ({ id: r.id, code: r.code, name: r.name })),
      menus: ctx.menus,
      isAdmin: ctx.isAdmin
    })
  } catch (e) {
    return handleError(e, '내 정보 조회 실패')
  }
}
