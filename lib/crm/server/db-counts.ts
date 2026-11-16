import { TABLES } from '@/lib/supabase/tables'
import { LOCKED_ROLE_CODE } from '@/lib/crm/menus'
import { isMissingSchema, loadRolesForUsers, type CrmContext } from '@/lib/crm/server/context'
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
