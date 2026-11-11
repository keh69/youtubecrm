import { TABLES } from '@/lib/supabase/tables'
import { getAutoCheckoutIso, getAttendanceWorkedSeconds, getKstYmd, isLateCheckIn } from '@/lib/attendance/time'
import { HttpError, MIGRATION_HINT, isMissingSchema, type Admin, type CrmContext } from '@/lib/crm/server/context'

export type DayRecord = {
  workDate: string
  status: string // present | late | absent | not_started | vacation | early_leave ...
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  absenceReason: string | null
  autoCheckout: boolean
}

function toRecord(row: any): DayRecord {
  const autoCheckout = Boolean(row.check_out_at && row.check_out_at === getAutoCheckoutIso(row.work_date))
  return {
    workDate: row.work_date,
    status: row.attendance_status || 'not_started',
    checkInAt: row.check_in_at || null,
    checkOutAt: row.check_out_at || null,
    workedMinutes:
      row.check_in_at && !row.check_out_at
        ? Math.floor(getAttendanceWorkedSeconds(row.check_in_at, null) / 60)
        : Number(row.worked_minutes || 0),
    absenceReason: row.absence_reason ?? null,
    autoCheckout
  }
}

async function logEvent(db: Admin, dayId: string, eventType: string, source: 'manual' | 'system' | 'admin', note: string, occurredAt = new Date().toISOString()) {
  const { error } = await db.from(TABLES.attendanceEvents).insert({ attendance_day_id: dayId, event_type: eventType, occurred_at: occurredAt, source, note })
  // 마이그레이션 전이라 event_type 제약에 걸리면 'correction' 으로 남긴다.
  if (error) await db.from(TABLES.attendanceEvents).insert({ attendance_day_id: dayId, event_type: 'correction', occurred_at: occurredAt, source, note })
}

async function audit(db: Admin, actorId: string, action: string, targetId: string, diff: Record<string, unknown>) {
  await db.from(TABLES.auditLogs).insert({ actor_user_id: actorId, action_type: action, target_type: 'attendance_day', target_id: targetId, diff_summary: diff })
}

// 퇴근을 안 누른 지난 날짜(오늘 23:59 이후 포함)는 그날 23:59 퇴근으로 자동 마감한다.
export async function closeOpenDays(db: Admin, userIds: string[]) {
  if (userIds.length === 0) return
  const today = getKstYmd(new Date())
  const { data } = await db
    .from(TABLES.attendanceDays)
    .select('id, user_id, work_date, check_in_at')
    .in('user_id', userIds)
    .not('check_in_at', 'is', null)
    .is('check_out_at', null)
    .lte('work_date', today)
  for (const row of data || []) {
    const closeAt = getAutoCheckoutIso(row.work_date)
    if (new Date() < new Date(closeAt)) continue
    const workedMinutes = Math.floor(getAttendanceWorkedSeconds(row.check_in_at, closeAt) / 60)
    const { data: updated } = await db
      .from(TABLES.attendanceDays)
      .update({ check_out_at: closeAt, worked_minutes: workedMinutes, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('check_out_at', null)
      .select('id')
    if (updated?.length) await logEvent(db, row.id, 'correction', 'system', '23:59 자동 퇴근 처리', closeAt)
  }
}

export async function loadDays(db: Admin, userIds: string[], fromYmd: string, toYmd: string) {
  if (userIds.length === 0) return [] as Array<DayRecord & { userId: string }>
  const { data, error } = await db
    .from(TABLES.attendanceDays)
    .select('*')
    .in('user_id', userIds)
    .gte('work_date', fromYmd)
    .lte('work_date', toYmd)
    .order('work_date', { ascending: true })
  if (error) throw error
  return (data || []).map((row: any) => ({ ...toRecord(row), userId: row.user_id as string }))
}

export async function checkIn(ctx: CrmContext) {
  const { db, profile } = ctx
  const today = getKstYmd(new Date())
  const nowIso = new Date().toISOString()
  const { data: existing } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', profile.id).eq('work_date', today).maybeSingle()

  if (existing?.attendance_status === 'absent') throw new HttpError(409, '오늘은 결근으로 처리되어 있습니다. 관리자에게 문의해 주세요.')
  if (existing?.check_in_at) return toRecord(existing)

  const status = isLateCheckIn(nowIso, today) ? 'late' : 'present'
  let row: any
  if (existing?.id) {
    const { data, error } = await db
      .from(TABLES.attendanceDays)
      .update({ attendance_status: status, check_in_at: nowIso, check_out_at: null, worked_minutes: 0, updated_at: nowIso })
      .eq('id', existing.id)
      .is('check_in_at', null)
      .select('*')
    if (error) throw error
    row = data?.[0]
  } else {
    const { data, error } = await db
      .from(TABLES.attendanceDays)
      .insert({ user_id: profile.id, work_date: today, attendance_status: status, check_in_at: nowIso })
      .select('*')
    // 동시에 두 번 눌러 unique(user_id, work_date)에 걸린 경우: 먼저 들어간 기록을 그대로 쓴다.
    if (error && error.code !== '23505') throw error
    row = data?.[0]
  }
  if (!row) {
    const { data } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', profile.id).eq('work_date', today).maybeSingle()
    return toRecord(data)
  }
  await logEvent(db, row.id, status, 'manual', '본인 출근')
  await audit(db, profile.id, 'check_in', row.id, { work_date: today, check_in_at: nowIso })
  return toRecord(row)
}

export async function checkOut(ctx: CrmContext) {
  const { db, profile } = ctx
  const today = getKstYmd(new Date())
  const nowIso = new Date().toISOString()
  const { data: existing } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', profile.id).eq('work_date', today).maybeSingle()
  if (!existing?.check_in_at) throw new HttpError(400, '출근을 먼저 눌러 주세요.')
  if (existing.check_out_at) return toRecord(existing)

  const workedMinutes = Math.floor(getAttendanceWorkedSeconds(existing.check_in_at, nowIso) / 60)
  const { data, error } = await db
    .from(TABLES.attendanceDays)
    .update({ check_out_at: nowIso, worked_minutes: workedMinutes, updated_at: nowIso })
    .eq('id', existing.id)
    .is('check_out_at', null)
    .select('*')
  if (error) throw error
  const row = data?.[0]
  if (!row) {
    const { data: again } = await db.from(TABLES.attendanceDays).select('*').eq('id', existing.id).maybeSingle()
    return toRecord(again)
  }
  await logEvent(db, row.id, 'correction', 'manual', '본인 퇴근')
  await audit(db, profile.id, 'check_out', row.id, { work_date: today, check_out_at: nowIso, worked_minutes: workedMinutes })
  return toRecord(row)
}

export async function setAbsence(ctx: CrmContext, userId: string, workDate: string, reason: string) {
  const { db, profile } = ctx
  const nowIso = new Date().toISOString()
  const { data: existing } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle()
  const patch = { attendance_status: 'absent', absence_reason: reason, updated_at: nowIso }
  const res = existing?.id
    ? await db.from(TABLES.attendanceDays).update(patch).eq('id', existing.id).select('*').single()
    : await db.from(TABLES.attendanceDays).insert({ user_id: userId, work_date: workDate, ...patch }).select('*').single()
  if (res.error) {
    if (isMissingSchema(res.error) || res.error.code === '23514') throw new HttpError(409, MIGRATION_HINT)
    throw res.error
  }
  await logEvent(db, res.data.id, 'absent', 'admin', `결근 처리: ${reason}`)
  await audit(db, profile.id, 'set_absence', res.data.id, { user_id: userId, work_date: workDate, reason, before: existing?.attendance_status || null })
  return toRecord(res.data)
}

export async function cancelAbsence(ctx: CrmContext, userId: string, workDate: string) {
  const { db, profile } = ctx
  const { data: existing } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle()
  if (!existing || existing.attendance_status !== 'absent') throw new HttpError(404, '결근 기록이 없습니다.')
  // 출근 기록이 남아 있으면 원래 상태(출근/지각)로 되돌리고, 없으면 기록 자체를 지운다.
  if (existing.check_in_at) {
    const status = isLateCheckIn(existing.check_in_at, workDate) ? 'late' : 'present'
    const { error } = await db.from(TABLES.attendanceDays).update({ attendance_status: status, absence_reason: null, updated_at: new Date().toISOString() }).eq('id', existing.id)
    if (error) throw error
    await logEvent(db, existing.id, 'absent_cancel', 'admin', '결근 취소')
  } else {
    const { error } = await db.from(TABLES.attendanceDays).delete().eq('id', existing.id)
    if (error) throw error
  }
  await audit(db, profile.id, 'cancel_absence', existing.id, { user_id: userId, work_date: workDate, reason: existing.absence_reason || null })
}
