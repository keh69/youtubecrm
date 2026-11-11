import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { audit, requireSettings } from '@/lib/crm/server/settings'
import { loadSubordinates } from '@/lib/crm/server/scope'
import { toAuthPassword } from '@/lib/crm/server/password'

type Params = { params: Promise<{ id: string }> }

// 설정 → 사원목록 → 비밀번호 초기화: 비밀번호를 그 사원의 아이디와 같게 만든다.
// 내 소속 하부 사원만(총관리자는 전체). 총관리자 계정은 초기화할 수 없다.
export async function POST(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 사원입니다.')

    const { data: target } = await ctx.db.from(TABLES.crmUsers).select('id, auth_user_id, login_id, name').eq('id', id).maybeSingle()
    if (!target) throw new HttpError(404, '사원을 찾을 수 없습니다.')
    if (target.id === ctx.profile.id) throw new HttpError(400, '내 비밀번호는 내정보에서 바꿔 주세요.')

    const subs = await loadSubordinates(ctx)
    const sub = subs.find((u) => u.id === id)
    if (!sub && !ctx.isSuperAdmin) throw new HttpError(403, '내 소속 하부의 사원만 초기화할 수 있습니다.')
    if (sub?.isSuperAdmin) throw new HttpError(403, '총 관리자 계정은 초기화할 수 없습니다.')

    const { error } = await ctx.db.auth.admin.updateUserById(target.auth_user_id, { password: toAuthPassword(target.login_id) })
    if (error) throw new HttpError(400, error.message)

    await audit(ctx, 'reset_password', 'crm_user', id, { login_id: target.login_id })
    return NextResponse.json({ ok: true, loginId: target.login_id })
  } catch (e) {
    return handleError(e, '비밀번호 초기화 실패')
  }
}
