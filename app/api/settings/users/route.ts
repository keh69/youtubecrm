import { NextResponse } from 'next/server'
import { getContext, handleError } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { createCrmAccount, newAccountSchema } from '@/lib/crm/server/accounts'

// 아이디 생성: 여기서 만든 아이디/비밀번호로 바로 로그인할 수 있다. 기본 역할은 '직원'.
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'create')
    const body = newAccountSchema.parse(await request.json())
    const id = await createCrmAccount(ctx.db, body, ctx.profile.id)
    await audit(ctx, 'create_user', 'crm_user', id, {
      login_id: body.loginId,
      name: body.name,
      affiliation_user_id: body.affiliationUserId || null,
      affiliation_role_id: body.affiliationUserId ? null : body.affiliationRoleId || null
    })
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return handleError(e, '아이디 생성 실패')
  }
}
