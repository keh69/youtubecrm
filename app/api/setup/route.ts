import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { passwordSchema, toAuthPassword } from '@/lib/crm/server/password'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { TABLES } from '@/lib/supabase/tables'
import { findAuthUserByEmail } from '@/lib/auth/session'
import { HttpError, handleError } from '@/lib/crm/server/context'

// 최초 설치: CRM 계정이 하나도 없을 때만 "총 관리자" 계정을 만들 수 있다.
// 환경변수 SETUP_CODE 가 있으면 그 코드를 알아야 한다(배포 직후 남이 먼저 만드는 것 방지).

async function hasAnyUser(db: ReturnType<typeof createSupabaseAdminClient>) {
  const { count, error } = await db.from(TABLES.crmUsers).select('id', { count: 'exact', head: true })
  if (error) throw error
  return Boolean(count)
}

export async function GET() {
  try {
    const db = createSupabaseAdminClient()
    return NextResponse.json({ needed: !(await hasAnyUser(db)), codeRequired: Boolean(process.env.SETUP_CODE) })
  } catch (e) {
    return handleError(e, '설치 상태 확인 실패')
  }
}

const bodySchema = z.object({
  setupCode: z.string().optional().default(''),
  loginId: z.string().trim().min(2, '아이디는 2자 이상이어야 합니다.').max(30).regex(/^[A-Za-z0-9._-]+$/, '아이디는 영문, 숫자, . _ - 만 쓸 수 있어요.'),
  password: passwordSchema,
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(30),
  email: z.string().trim().email('이메일 형식이 올바르지 않습니다.'),
  phone: z.string().trim().max(20).optional().default('')
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const expected = process.env.SETUP_CODE || ''
    if (expected) {
      const a = Buffer.from(body.setupCode)
      const b = Buffer.from(expected)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, '설치 코드가 맞지 않습니다.')
    }
    const db = createSupabaseAdminClient()
    if (await hasAnyUser(db)) throw new HttpError(409, '이미 설치가 끝났습니다. 로그인해 주세요.')
    if (await findAuthUserByEmail(db, body.email)) throw new HttpError(409, '이미 사용 중인 이메일입니다.')

    const { data: created, error: authError } = await db.auth.admin.createUser({
      email: body.email,
      password: toAuthPassword(body.password),
      email_confirm: true,
      user_metadata: { login_id: body.loginId, display_name: body.name }
    })
    if (authError || !created.user) throw new HttpError(400, authError?.message || '계정 생성 실패')

    const { data: user, error } = await db
      .from(TABLES.crmUsers)
      .insert({ auth_user_id: created.user.id, login_id: body.loginId, email: body.email, name: body.name, phone: body.phone || null, role_type: 'super_admin', employment_status: 'active' })
      .select('id')
      .single()
    if (error || !user) {
      await db.auth.admin.deleteUser(created.user.id)
      throw error || new Error('프로필 생성 실패')
    }
    const { data: role } = await db.from(TABLES.roles).select('id').eq('code', 'super_admin').single()
    await db.from(TABLES.userRoles).insert({ user_id: user.id, role_id: role!.id })
    await db.from(TABLES.auditLogs).insert({ actor_user_id: user.id, action_type: 'initial_setup', target_type: 'crm_user', target_id: user.id, diff_summary: { login_id: body.loginId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '최초 관리자 생성 실패')
  }
}
