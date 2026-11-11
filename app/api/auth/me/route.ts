import { NextResponse } from 'next/server'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { DEFAULT_SKIN, isSkinKey } from '@/lib/crm/skins'
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
      skin: isSkinKey(ctx.profile.skin) ? ctx.profile.skin : DEFAULT_SKIN
    })
  } catch (e) {
    return handleError(e, '내 정보 조회 실패')
  }
}
