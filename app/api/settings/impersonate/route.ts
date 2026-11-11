import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { loadSubordinates } from '@/lib/crm/server/scope'

const bodySchema = z.object({ userId: z.string().uuid('잘못된 사원입니다.') })

// 설정 → 사원목록 → "이 아이디로 로그인": 비밀번호 없이 내 소속 하부 사원의 로그인 세션을 만든다.
// 원래(관리자) 세션은 브라우저가 따로 보관했다가 '관리자로 복귀'로 되돌린다.
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'employees')
    const { userId } = bodySchema.parse(await request.json())

    const target = (await loadSubordinates(ctx)).find((u) => u.id === userId)
    if (!target) throw new HttpError(403, '내 소속 하부의 사원만 로그인할 수 있습니다.')
    if (!target.active) throw new HttpError(400, '사용이 중지된 계정입니다.')
    if (target.isSuperAdmin) throw new HttpError(403, '총 관리자 계정으로는 들어갈 수 없습니다.')

    const { data: row } = await ctx.db.from(TABLES.crmUsers).select('email').eq('id', userId).single()
    const { data: link, error: linkError } = await ctx.db.auth.admin.generateLink({ type: 'magiclink', email: row!.email })
    if (linkError || !link?.properties?.hashed_token) throw new HttpError(400, linkError?.message || '로그인 링크를 만들지 못했습니다.')

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
    if (verifyError || !verified.session) throw new HttpError(400, verifyError?.message || '사원 세션을 만들지 못했습니다.')

    await audit(ctx, 'impersonate', 'crm_user', userId, { login_id: target.loginId, name: target.name })
    return NextResponse.json({
      accessToken: verified.session.access_token,
      refreshToken: verified.session.refresh_token,
      target: { id: target.id, name: target.name, loginId: target.loginId }
    })
  } catch (e) {
    return handleError(e, '사원 아이디로 로그인 실패')
  }
}
