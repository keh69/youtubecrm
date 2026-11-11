import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, type CrmContext } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'
import { loadSubordinates } from '@/lib/crm/server/scope'
import { employeeEditSchema, softDeleteAccount, updateEmployeeBasics } from '@/lib/crm/server/accounts'

type Params = { params: Promise<{ id: string }> }

// 사원목록에 보이는 사원(내 소속 하부, 총 관리자는 전체)만 고칠 수 있다. 총 관리자 계정은 총 관리자만 고칠 수 있다.
async function loadTarget(ctx: CrmContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 사원입니다.')
  if (id === ctx.profile.id) throw new HttpError(400, '내 정보는 내정보 화면에서 바꿔 주세요.')
  const sub = (await loadSubordinates(ctx)).find((u) => u.id === id)
  if (!sub) throw new HttpError(403, '내 소속 하부의 사원만 고칠 수 있습니다.')
  const { data: row } = await ctx.db.from(TABLES.crmUsers).select('id, auth_user_id, login_id, email, name').eq('id', id).maybeSingle()
  if (!row) throw new HttpError(404, '사원을 찾을 수 없습니다.')
  return { sub, row }
}

// 설정 → 01 사원목록 → [편집]: 이름·이메일·전화번호 (상세설정 '편집' 권한 필요)
export async function PATCH(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'employees_edit')
    const { id } = await context.params
    const { sub, row } = await loadTarget(ctx, id)
    if (sub.isSuperAdmin && !ctx.isSuperAdmin) throw new HttpError(403, '총 관리자 계정은 고칠 수 없습니다.')
    const body = employeeEditSchema.parse(await request.json())
    await updateEmployeeBasics(ctx.db, row, body)
    await audit(ctx, 'edit_employee', 'crm_user', id, { name: body.name, phone: body.phone, email_changed: Boolean(body.email && body.email !== row.email) })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '사원 정보 수정 실패')
  }
}

// 설정 → 01 사원목록 → [삭제] (상세설정 '삭제' 권한 필요)
// 아이디만 지우고 영상·근태 기록은 남긴다(06 덤프파일에서 보고, 영상 담당자를 바꿀 수 있다).
export async function DELETE(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'employees_delete')
    const { id } = await context.params
    const { sub, row } = await loadTarget(ctx, id)
    if (sub.isSuperAdmin) throw new HttpError(403, '총 관리자 계정은 삭제할 수 없습니다.')
    await softDeleteAccount(ctx.db, row)
    await audit(ctx, 'delete_employee', 'crm_user', id, { login_id: row.login_id, name: row.name })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '사원 삭제 실패')
  }
}
