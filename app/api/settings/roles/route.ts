import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { DEFAULT_MENUS_FOR_NEW_ROLE, MENU_KEYS } from '@/lib/crm/menus'
import { getContext, handleError } from '@/lib/crm/server/context'
import { assertRoleNameFree, audit, requireSettingsTab, saveRoleMenus } from '@/lib/crm/server/settings'

const bodySchema = z.object({
  name: z.string().trim().min(1, '역할 이름을 입력해 주세요.').max(30, '역할 이름은 30자까지 쓸 수 있어요.'),
  menus: z.array(z.enum(MENU_KEYS)).optional()
})

// 역할 추가 (예: A팀장)
export async function POST(request: Request) {
  try {
    const ctx = await getContext(request)
    requireSettingsTab(ctx, 'roles')
    const body = bodySchema.parse(await request.json())
    await assertRoleNameFree(ctx, body.name)
    const code = `r_${crypto.randomBytes(5).toString('hex')}`
    // 새 역할은 맨 아래에 붙인다.
    const { data: last } = await ctx.db.from(TABLES.roles).select('sort_order').order('sort_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    const sortOrder = typeof last?.sort_order === 'number' ? last.sort_order + 1 : 0
    const { data, error } = await ctx.db.from(TABLES.roles).insert({ code, name: body.name, sort_order: sortOrder }).select('id, code, name').single()
    if (error) throw error
    await saveRoleMenus(ctx, code, body.menus ?? DEFAULT_MENUS_FOR_NEW_ROLE)
    await audit(ctx, 'create_role', 'role', data.id, { name: body.name })
    return NextResponse.json({ ok: true, role: data })
  } catch (e) {
    return handleError(e, '역할 추가 실패')
  }
}
