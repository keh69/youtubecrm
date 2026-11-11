import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config'
import { TABLES } from '@/lib/supabase/tables'
import { escapeLikePattern } from '@/lib/supabase/query-utils'
import { handleError } from '@/lib/crm/server/context'

// 아이디 + 비밀번호 로그인. 아이디→이메일 변환을 서버 안에서만 해서
// 아이디로 이메일을 알아내는 통로(예전 resolve-login)를 없앴다.
const bodySchema = z.object({
  loginId: z.string().trim().min(1, '아이디를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.')
})

const FAIL = '아이디 또는 비밀번호가 맞지 않습니다.'

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const db = createSupabaseAdminClient()
    const { data: user } = await db
      .from(TABLES.crmUsers)
      .select('id, email, employment_status')
      .ilike('login_id', escapeLikePattern(body.loginId))
      .maybeSingle()

    if (!user?.email) return NextResponse.json({ error: FAIL }, { status: 401 })

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: body.password })
    if (error || !data.session) return NextResponse.json({ error: FAIL }, { status: 401 })

    if (user.employment_status !== 'active') {
      return NextResponse.json({ error: '사용이 중지된 계정입니다. 관리자에게 문의해 주세요.' }, { status: 403 })
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    await db.from(TABLES.loginEvents).insert({
      user_id: user.id,
      ip_address: forwarded.split(',')[0]?.trim() || null,
      user_agent: request.headers.get('user-agent') || null,
      success: true,
      network_zone_type: 'unknown',
      risk_level: 'low'
    })

    return NextResponse.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token
    })
  } catch (e) {
    return handleError(e, '로그인 중 오류가 발생했습니다.')
  }
}
