import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, handleError, loadRolesForUsers } from '@/lib/crm/server/context'
import { loadAffiliationHiddenCodes } from '@/lib/crm/server/settings'
import { selectUserRows } from '@/lib/crm/server/scope'
import { createCrmAccount, newAccountSchema } from '@/lib/crm/server/accounts'

// 회원가입(로그인 없이 누구나): 설정 > 아이디 만들기와 같은 내용으로 아이디를 만든다. 가입 즉시 기본 역할(역할설정 표 맨 아래 역할)로 로그인할 수 있다.

// 소속 목록: 역할설정 > 상세설정 '하부'가 켜진 역할별로, 그 역할을 가진 사용 중 아이디(이름·아이디)
export async function GET() {
  try {
    const db = createSupabaseAdminClient()
    const { rows } = await selectUserRows(db, 'id, name, login_id, role_type, custom_role_code, employment_status', 'name')
    const active = rows.filter((u) => u.employment_status === 'active')
    const { allRoles, rolesByUser } = await loadRolesForUsers(db, active)
    const hidden = await loadAffiliationHiddenCodes(db)
    const groups = allRoles
      .filter((r) => !hidden.has(r.code))
      .map((r) => ({
        role: r.name,
        people: active.filter((u) => (rolesByUser.get(u.id) || []).some((x) => x.id === r.id)).map((u) => ({ id: u.id, name: u.name, loginId: u.login_id }))
      }))
      .filter((g) => g.people.length > 0)
    return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return handleError(e, '소속 목록 조회 실패')
  }
}

// 가입: 봇 막기용 숨은 칸(website)은 사람이 채울 수 없으니 값이 있으면 거절한다.
const signupSchema = newAccountSchema.extend({ website: z.string().optional() })

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json())
    if (body.website) throw new HttpError(400, '가입할 수 없습니다.')
    const db = createSupabaseAdminClient()
    const id = await createCrmAccount(db, { ...body, affiliationRoleId: null }, null)
    // 감사 기록: 가입한 본인이 한 일로 남긴다
    await db.from(TABLES.auditLogs).insert({
      actor_user_id: id,
      action_type: 'signup',
      target_type: 'crm_user',
      target_id: id,
      diff_summary: { login_id: body.loginId, name: body.name, affiliation_user_id: body.affiliationUserId || null }
    })
    return NextResponse.json({ ok: true, loginId: body.loginId })
  } catch (e) {
    return handleError(e, '회원가입 실패')
  }
}
