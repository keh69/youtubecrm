import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError } from '@/lib/crm/server/context'
import { audit, requireSettingsTab } from '@/lib/crm/server/settings'

const bodySchema = z.object({ roleIds: z.array(z.string().uuid()).min(1).max(200) })

// 역할설정: 마우스로 끌어서 바꾼 역할 순서를 저장한다. 모든 화면(목록, 드롭다운)이 이 순서를 따른다.
export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'roles')
    const { roleIds } = bodySchema.parse(await request.json())
    const { data: roles, error } = await ctx.db.from(TABLES.roles).select('id')
    if (error) throw error
    const known = new Set((roles || []).map((r: any) => r.id))
    if (new Set(roleIds).size !== roleIds.length || roleIds.length !== known.size || roleIds.some((id) => !known.has(id))) {
      throw new HttpError(409, '역할 목록이 바뀌었습니다. 새로고침한 뒤 다시 시도해 주세요.')
    }
    await Promise.all(
      roleIds.map(async (id, index) => {
        const { error: e } = await ctx.db.from(TABLES.roles).update({ sort_order: index }).eq('id', id)
        if (e) throw e
      })
    )
    await audit(ctx, 'reorder_roles', 'role', null, { order: roleIds })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleError(e, '역할 순서 저장 실패')
  }
}
