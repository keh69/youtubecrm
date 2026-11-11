import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { MENU_KEYS } from '@/lib/crm/menus'
import { HttpError, getContext, handleError, type CrmContext } from '@/lib/crm/server/context'
import { assertRoleNameFree, audit, isSystemRole, requireSettings, saveRoleMenus } from '@/lib/crm/server/settings'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1, '역할 이름을 입력해 주세요.').max(30, '역할 이름은 30자까지 쓸 수 있어요.').optional(),
  menus: z.array(z.enum(MENU_KEYS)).optional()
})

async function loadRole(ctx: CrmContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 역할입니다.')
  const { data } = await ctx.db.from(TABLES.roles).select('id, code, name').eq('id', id).maybeSingle()
  if (!data) throw new HttpError(404, '역할을 찾을 수 없습니다.')
  return data
}

// 역할 이름 변경 / 볼 수 있는 메뉴(체크박스) 저장
export async function PATCH(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    const { id } = await context.params
    const role = await loadRole(ctx, id)
    const body = patchSchema.parse(await request.json())
    if (body.name !== undefined && body.name !== role.name) {
      await assertRoleNameFree(ctx, body.name, role.id)
      const { error } = await ctx.db.from(TABLES.roles).update({ name: body.name }).eq('id', role.id)
      if (error) throw error
    }
    if (body.menus) await saveRoleMenus(ctx, role.code, body.menus)
    await audit(ctx, 'update_role', 'role', role.id, { name: body.name, menus: body.menus })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '역할 저장 실패')
  }
}

// 역할 삭제 (총 관리자/관리자 역할은 삭제 불가). 이 역할을 소속으로 둔 직원은 소속이 비워진다.
export async function DELETE(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    const { id } = await context.params
    const role = await loadRole(ctx, id)
    if (isSystemRole(role.code)) throw new HttpError(400, `'${role.name}' 역할은 삭제할 수 없습니다.`)
    if (ctx.roles.some((r) => r.id === role.id) && !ctx.isAdmin) {
      throw new HttpError(400, '내가 가진 역할은 삭제할 수 없습니다.')
    }
    const { error } = await ctx.db.from(TABLES.roles).delete().eq('id', role.id)
    if (error) throw error
    await ctx.db.from(TABLES.roleMenuPermissions).delete().eq('role_type', role.code)
    await audit(ctx, 'delete_role', 'role', role.id, { name: role.name, code: role.code })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '역할 삭제 실패')
  }
}
