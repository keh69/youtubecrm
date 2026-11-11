import { NextResponse } from 'next/server'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { DEFAULT_SKIN } from '@/lib/crm/skins'
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
      isAdmin: ctx.isAdmin,
      isSuperAdmin: ctx.roles.some((r) => r.code === LOCKED_ROLE_CODE),
      // 디자인 고르는 기능을 없애서 저장된 값과 상관없이 모두 기본 디자인(v5)으로 연다.
      skin: DEFAULT_SKIN
    })
  } catch (e) {
    return handleError(e, '내 정보 조회 실패')
  }
}
