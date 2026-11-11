import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { assertAffiliationColumn, assertSuperAdminRemains, audit, requireSettings } from '@/lib/crm/server/settings'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({ roleIds: z.array(z.string().uuid()).max(50) })

// 역할부여: 이 계정이 가진 역할 목록을 통째로 바꾼다(추가/제거).
export async function PUT(request: Request, context: Params) {
  try {
    const ctx = await getContext(request)
    requireSettings(ctx)
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, '잘못된 계정입니다.')
    const body = bodySchema.parse(await request.json())
    const roleIds = [...new Set(body.roleIds)]
    await assertAffiliationColumn(ctx) // 마이그레이션(기존 직급 → 역할 옮기기) 전에는 역할부여를 막는다.

    const { data: target } = await ctx.db.from(TABLES.crmUsers).select('id, name').eq('id', id).maybeSingle()
    if (!target) throw new HttpError(404, '계정을 찾을 수 없습니다.')

    const { data: allRoles } = await ctx.db.from(TABLES.roles).select('id, code, name')
    const known = new Map((allRoles || []).map((r: any) => [r.id, r]))
    if (roleIds.some((r) => !known.has(r))) throw new HttpError(400, '없는 역할이 포함되어 있습니다.')

    // 총 관리자 역할은 총 관리자만 주고 뺄 수 있다.
    const superRole = (allRoles || []).find((r: any) => r.code === LOCKED_ROLE_CODE)
    const { data: currentLinks } = await ctx.db.from(TABLES.userRoles).select('role_id').eq('user_id', id)
    const current = new Set((currentLinks || []).map((l: any) => l.role_id))
    if (superRole && current.has(superRole.id) !== roleIds.includes(superRole.id)) {
      if (!ctx.roles.some((r) => r.code === LOCKED_ROLE_CODE)) throw new HttpError(403, '총 관리자 역할은 총 관리자만 변경할 수 있습니다.')
      await assertSuperAdminRemains(ctx, { userId: id, roleIds })
    }

    const toRemove = [...current].filter((r) => !roleIds.includes(r as string))
    const toAdd = roleIds.filter((r) => !current.has(r))
    if (toRemove.length) {
      const { error } = await ctx.db.from(TABLES.userRoles).delete().eq('user_id', id).in('role_id', toRemove)
      if (error) throw error
    }
    if (toAdd.length) {
      const { error } = await ctx.db
        .from(TABLES.userRoles)
        .insert(toAdd.map((roleId) => ({ user_id: id, role_id: roleId, granted_by: ctx.profile.id })))
      if (error) throw error
    }

    await audit(ctx, 'set_user_roles', 'crm_user', id, {
      added: toAdd.map((r) => known.get(r)?.name),
      removed: toRemove.map((r) => known.get(r as string)?.name)
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '역할 부여 실패')
  }
}
