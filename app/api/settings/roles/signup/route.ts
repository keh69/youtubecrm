import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { setSignupRole } from '@/lib/crm/server/accounts'

const bodySchema = z.object({ roleId: z.string().uuid('역할을 골라 주세요.') })

// 상세설정 '회원가입 시 역할': 새 아이디(회원가입·아이디 만들기)가 받을 역할을 정한다.
export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'roles')
    const { roleId } = bodySchema.parse(await request.json())
    const { data: role } = await ctx.db.from(TABLES.roles).select('id, code, name').eq('id', roleId).maybeSingle()
    if (!role) throw new HttpError(404, '역할을 찾을 수 없습니다.')
    await setSignupRole(ctx.db, role.code)
    await audit(ctx, 'set_signup_role', 'role', role.id, { name: role.name })
    return NextResponse.json({ ok: true, name: role.name })
  } catch (e) {
    return handleError(e, '가입역할 저장 실패')
  }
}
