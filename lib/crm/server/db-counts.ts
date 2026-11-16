import { TABLES } from '@/lib/supabase/tables'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { HttpError, isMissingSchema, loadRolesForUsers, type CrmContext } from '@/lib/crm/server/context'
import { loadVisibleUsers, type ScopedUser } from '@/lib/crm/server/scope'

// 디비입력: 직원별 하루 DB 개수(youtubeCRM_db_counts, SQL 270)
export const DB_COUNTS_HINT = 'DB 업데이트가 필요합니다. supabase/sql/simple/270_db_counts.sql 을 Supabase SQL Editor에서 실행해 주세요.'

export type DbCountRow = { userId: string; date: string; count: number }

// 기간 안의 DB 개수. 표가 아직 없으면(SQL 270 실행 전) ready=false 로 빈 목록
export async function loadDbCounts(db: CrmContext['db'], userIds: string[], from: string, to: string): Promise<{ ready: boolean; rows: DbCountRow[] }> {
  if (!userIds.length) return { ready: true, rows: [] }
  const rows: DbCountRow[] = []
  // 사람이 많아도 주소가 너무 길어지지 않게 나눠서 읽는다
  for (let i = 0; i < userIds.length; i += 150) {
    const { data, error } = await db
      .from(TABLES.dbCounts)
      .select('user_id, work_date, db_count')
      .in('user_id', userIds.slice(i, i + 150))
      .gte('work_date', from)
      .lte('work_date', to)
    if (error) {
      if (isMissingSchema(error)) return { ready: false, rows: [] }
      throw error
    }
    for (const r of (data || []) as any[]) rows.push({ userId: r.user_id, date: String(r.work_date).slice(0, 10), count: Number(r.db_count || 0) })
  }
  return { ready: true, rows }
}

// 디비입력 표의 직원: 내가 볼 수 있는 직원(나 + 하부, 총관리자는 전체) 중 총 관리자(admin)는 뺀다
export async function loadDbPeople(ctx: CrmContext): Promise<ScopedUser[]> {
  const people = await loadVisibleUsers(ctx)
  const { rolesByUser } = await loadRolesForUsers(ctx.db, people.map((p) => ({ id: p.id, role_type: '', custom_role_code: null }) as any))
  return people.filter((p) => !(rolesByUser.get(p.id) || []).some((r) => r.code === LOCKED_ROLE_CODE))
}

// ── 기타(회원가입 안 한 사람): 디비입력에서 이름만 추가해 DB 를 적는다. 데이터 저장용이라 통계에는 넣지 않는다(SQL 280)
export const DB_EXTRA_HINT = 'DB 업데이트가 필요합니다. supabase/sql/simple/280_db_extra.sql 을 Supabase SQL Editor에서 실행해 주세요.'
export type DbExtraPerson = { id: string; name: string; ownerId: string }

// 내가 볼 수 있는 직원(나 포함)이 추가한 기타 사람들과 그 기간 DB
export async function loadDbExtras(ctx: CrmContext, from: string, to: string): Promise<{ ready: boolean; people: DbExtraPerson[]; counts: Array<{ personId: string; date: string; count: number }> }> {
  const owners = (await loadVisibleUsers(ctx)).map((p) => p.id)
  if (!owners.includes(ctx.profile.id)) owners.push(ctx.profile.id)
  let q = ctx.db.from(TABLES.dbExtraPeople).select('id, name, owner_user_id').order('name', { ascending: true })
  if (!ctx.isSuperAdmin) q = q.in('owner_user_id', owners)
  const { data, error } = await q
  if (error) {
    if (isMissingSchema(error)) return { ready: false, people: [], counts: [] }
    throw error
  }
  const people = ((data || []) as any[]).map((r) => ({ id: r.id as string, name: r.name as string, ownerId: r.owner_user_id as string }))
  if (!people.length) return { ready: true, people, counts: [] }
  const res = await ctx.db
    .from(TABLES.dbExtraCounts)
    .select('person_id, work_date, db_count')
    .in('person_id', people.map((p) => p.id))
    .gte('work_date', from)
    .lte('work_date', to)
  if (res.error) {
    if (isMissingSchema(res.error)) return { ready: false, people: [], counts: [] }
    throw res.error
  }
  return { ready: true, people, counts: ((res.data || []) as any[]).map((r) => ({ personId: r.person_id, date: String(r.work_date).slice(0, 10), count: Number(r.db_count || 0) })) }
}

// 이 기타 사람을 고칠 수 있나(추가한 직원을 내가 볼 수 있어야 한다)
export async function assertExtraEditable(ctx: CrmContext, personId: string) {
  const { data, error } = await ctx.db.from(TABLES.dbExtraPeople).select('id, owner_user_id').eq('id', personId).maybeSingle()
  if (error) {
    if (isMissingSchema(error)) throw new HttpError(503, DB_EXTRA_HINT)
    throw error
  }
  if (!data) throw new HttpError(404, '이름을 찾을 수 없습니다.')
  if (ctx.isSuperAdmin || data.owner_user_id === ctx.profile.id) return
  const visible = await loadVisibleUsers(ctx)
  if (!visible.some((p) => p.id === data.owner_user_id)) throw new HttpError(403, '이 이름을 고칠 권한이 없습니다.')
}
