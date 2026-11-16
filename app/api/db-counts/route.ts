import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TABLES } from '@/lib/supabase/tables'
import { HttpError, getContext, handleError, isMissingSchema, requireMenu } from '@/lib/crm/server/context'
import { DB_COUNTS_HINT, loadDbCounts, loadDbPeople } from '@/lib/crm/server/db-counts'
import { getKstYmd } from '@/lib/attendance/time'

// 디비입력: 한 달 동안 직원별 하루 DB 개수
//  GET ?month=YYYY-MM → { month, from, to, ready, people, counts }
//  PUT { userId, date, count } → 그 칸 저장(count 가 null 이면 비우기)
const MONTH = /^\d{4}-\d{2}$/
const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export async function GET(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'db_input')
    const url = new URL(request.url)
    const month = url.searchParams.get('month') || getKstYmd(new Date()).slice(0, 7)
    if (!MONTH.test(month)) throw new HttpError(400, '달 형식이 올바르지 않습니다.')
    const from = `${month}-01`
    const to = `${month}-${String(lastDay(month)).padStart(2, '0')}`
    const people = await loadDbPeople(ctx)
    const { ready, rows } = await loadDbCounts(ctx.db, people.map((p) => p.id), from, to)
    // 사용 중인 직원 + 이 달에 적힌 기록이 있는 직원(퇴사·삭제된 사람 기록도 보이게)
    const withRows = new Set(rows.map((r) => r.userId))
    const list = people.filter((p) => p.active || withRows.has(p.id))
    return NextResponse.json({
      month,
      from,
      to,
      today: getKstYmd(new Date()),
      ready,
      hint: ready ? null : DB_COUNTS_HINT,
      people: list.map((p) => ({ id: p.id, name: p.name, loginId: p.loginId, affiliationName: p.affiliationName })),
      counts: rows
    })
  } catch (e) {
    return handleError(e, '디비 조회 실패')
  }
}

const bodySchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(0).max(100000).nullable()
})

export async function PUT(request: Request) {
  try {
    const ctx = await getContext(request)
    requireMenu(ctx, 'db_input')
    const body = bodySchema.parse(await request.json())
    if (body.date > getKstYmd(new Date())) throw new HttpError(400, '오늘 이후 날짜에는 적을 수 없습니다.')
    const people = await loadDbPeople(ctx)
    if (!people.some((p) => p.id === body.userId)) throw new HttpError(403, '이 직원의 DB를 적을 권한이 없습니다.')
    const t = ctx.db.from(TABLES.dbCounts)
    const { error } =
      body.count === null
        ? await t.delete().eq('user_id', body.userId).eq('work_date', body.date)
        : await t.upsert(
            { user_id: body.userId, work_date: body.date, db_count: body.count, updated_by: ctx.profile.id, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,work_date' }
          )
    if (error) {
      if (isMissingSchema(error)) throw new HttpError(503, DB_COUNTS_HINT)
      throw error
    }
    return NextResponse.json({ ok: true, userId: body.userId, date: body.date, count: body.count })
  } catch (e) {
    return handleError(e, '디비 저장 실패')
  }
}
