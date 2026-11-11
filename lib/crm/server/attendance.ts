import { TABLES } from '@/lib/supabase/tables'
import { getAutoCheckoutIso, getAttendanceWorkedSeconds, getKstIsoAtTime, getKstYmd, isLateCheckIn, isOvertimeCheckOut } from '@/lib/attendance/time'
import { HttpError, MIGRATION_HINT, isMissingSchema, type Admin, type CrmContext } from '@/lib/crm/server/context'

export type DayRecord = {
  workDate: string
  status: string // present | late | absent | not_started | vacation | early_leave ...
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  absenceReason: string | null
  autoCheckout: boolean
  late: boolean // 09:00 이후 출근
  overtime: boolean // 19:00 이후 퇴근(자동 퇴근 제외)
}

function toRecord(row: any): DayRecord {
  const autoCheckout = Boolean(row.check_out_at && new Date(row.check_out_at).getTime() === new Date(getAutoCheckoutIso(row.work_date)).getTime())
  const absent = row.attendance_status === 'absent'
  return {
    late: !absent && isLateCheckIn(row.check_in_at || null, row.work_date),
    overtime: !absent && !autoCheckout && isOvertimeCheckOut(row.check_out_at || null, row.work_date),
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
  // 이미 출근 기록이 있는 날은 결근으로 바꾸지 않는다(고치려면 근태통계 달력의 '수정'을 쓴다)
  if (existing?.check_in_at) throw new HttpError(409, `이미 출근 기록(${kstHm(existing.check_in_at)})이 있어 결근 처리할 수 없습니다.`)
  if (existing?.attendance_status === 'absent') throw new HttpError(409, '이미 결근으로 처리된 날입니다.')
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

/* ───────── 미처리 처리(설정 > 07 미처리) ─────────
   관리자가 그날의 출근·퇴근을 정해 준다. 시간은 KST "HH:MM".
   - in: 출근(09:00 이전) / in_late: 출근(지각, 09:00 이후) / out: 퇴근(19:00 이전) / out_overtime: 퇴근(야근, 19:00 이후)
   - off: 휴무(쉬는 날) / absent 는 setAbsence 를 쓴다
   23:59 는 '자동 퇴근(미처리)' 표시와 구별할 수 없어서 쓰지 않는다. */
export type ResolveAction = 'in' | 'in_late' | 'out' | 'out_overtime' | 'off'

export async function resolveDay(ctx: CrmContext, userId: string, workDate: string, action: ResolveAction, time: string | null, note: string) {
  const { db, profile } = ctx
  const nowIso = new Date().toISOString()
  const { data: existing } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle()
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return getKstIsoAtTime(workDate, h, m, 0)
  }
  let patch: Record<string, unknown>
  let eventType = 'correction'

  if (action === 'off') {
    patch = { attendance_status: 'vacation', absence_reason: note || '휴무', updated_at: nowIso }
    eventType = 'vacation'
  } else {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) throw new HttpError(400, '시간을 09:00 처럼 적어 주세요.')
    const iso = at(time)
    if (action === 'in' || action === 'in_late') {
      const late = isLateCheckIn(iso, workDate)
      if (action === 'in' && late) throw new HttpError(400, '09:00 이후는 출근(지각)으로 골라 주세요.')
      if (action === 'in_late' && !late) throw new HttpError(400, '출근(지각)은 09:00 이후 시간이어야 합니다.')
      const out = existing?.check_out_at || null
      if (out && new Date(out) <= new Date(iso)) throw new HttpError(400, '출근 시간이 퇴근 시간보다 늦습니다.')
      patch = {
        attendance_status: late ? 'late' : 'present',
        absence_reason: null,
        check_in_at: iso,
        worked_minutes: out ? Math.floor(getAttendanceWorkedSeconds(iso, out) / 60) : 0,
        updated_at: nowIso
      }
      eventType = late ? 'late' : 'present'
    } else {
      if (!existing?.check_in_at) throw new HttpError(400, '출근 기록이 없습니다. 출근을 먼저 정해 주세요.')
      if (time === '23:59') throw new HttpError(400, '23:59 는 자동 퇴근 시각이라 쓸 수 없습니다. 23:58 까지 적어 주세요.')
      const overtime = isOvertimeCheckOut(iso, workDate)
      if (action === 'out' && overtime) throw new HttpError(400, '19:00 이후는 퇴근(야근)으로 골라 주세요.')
      if (action === 'out_overtime' && !overtime) throw new HttpError(400, '퇴근(야근)은 19:00 이후 시간이어야 합니다.')
      if (new Date(iso) <= new Date(existing.check_in_at)) throw new HttpError(400, '퇴근 시간이 출근 시간보다 빠릅니다.')
      patch = { check_out_at: iso, worked_minutes: Math.floor(getAttendanceWorkedSeconds(existing.check_in_at, iso) / 60), updated_at: nowIso }
    }
  }

  const res = existing?.id
    ? await db.from(TABLES.attendanceDays).update(patch).eq('id', existing.id).select('*').single()
    : await db.from(TABLES.attendanceDays).insert({ user_id: userId, work_date: workDate, ...patch }).select('*').single()
  if (res.error) throw res.error
  await logEvent(db, res.data.id, eventType, 'admin', `미처리 처리: ${note || action}`)
  await audit(db, profile.id, 'resolve_attendance', res.data.id, { user_id: userId, work_date: workDate, action, time })
  return toRecord(res.data)
}

/* ───────── 근태통계 달력: 하루 근태 고치기·지우기('수정가능' 권한) ─────────
   kind: normal(출근·퇴근 시간) / absent(결근) / vacation(휴무). 시간은 KST "HH:MM", 비우면 기록 없음. */
export type DayEdit = { kind: 'normal' | 'absent' | 'vacation'; checkIn: string | null; checkOut: string | null; reason: string }

export async function editDay(ctx: CrmContext, userId: string, workDate: string, edit: DayEdit) {
  const { db, profile } = ctx
  const nowIso = new Date().toISOString()
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return getKstIsoAtTime(workDate, h, m, 0)
  }
  let patch: Record<string, unknown>
  if (edit.kind === 'absent' || edit.kind === 'vacation') {
    patch = {
      attendance_status: edit.kind,
      absence_reason: edit.reason || (edit.kind === 'absent' ? '결근' : '휴무'),
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      updated_at: nowIso
    }
  } else {
    if (edit.checkOut && !edit.checkIn) throw new HttpError(400, '퇴근 시간만 넣을 수는 없습니다. 출근 시간도 넣어 주세요.')
    if (edit.checkOut === '23:59') throw new HttpError(400, '23:59 는 자동 퇴근 시각이라 쓸 수 없습니다. 23:58 까지 적어 주세요.')
    const inIso = edit.checkIn ? at(edit.checkIn) : null
    const outIso = edit.checkOut ? at(edit.checkOut) : null
    if (inIso && outIso && new Date(outIso) <= new Date(inIso)) throw new HttpError(400, '퇴근 시간이 출근 시간보다 빠릅니다.')
    patch = {
      attendance_status: inIso ? (isLateCheckIn(inIso, workDate) ? 'late' : 'present') : 'not_started',
      absence_reason: null,
      check_in_at: inIso,
      check_out_at: outIso,
      worked_minutes: inIso && outIso ? Math.floor(getAttendanceWorkedSeconds(inIso, outIso) / 60) : 0,
      updated_at: nowIso
    }
  }
  const { data: existing } = await db.from(TABLES.attendanceDays).select('id').eq('user_id', userId).eq('work_date', workDate).maybeSingle()
  const res = existing?.id
    ? await db.from(TABLES.attendanceDays).update(patch).eq('id', existing.id).select('*').single()
    : await db.from(TABLES.attendanceDays).insert({ user_id: userId, work_date: workDate, ...patch }).select('*').single()
  if (res.error) {
    if (res.error.code === '23514') throw new HttpError(409, MIGRATION_HINT)
    throw res.error
  }
  await logEvent(db, res.data.id, edit.kind === 'absent' ? 'absent' : edit.kind === 'vacation' ? 'vacation' : 'correction', 'admin', `근태 수정: ${edit.kind} ${edit.checkIn || '-'}~${edit.checkOut || '-'}`)
  await audit(db, profile.id, 'edit_attendance', res.data.id, { user_id: userId, work_date: workDate, ...edit })
  return toRecord(res.data)
}

export async function deleteDay(ctx: CrmContext, userId: string, workDate: string) {
  const { db, profile } = ctx
  const { data: existing } = await db.from(TABLES.attendanceDays).select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle()
  if (!existing) throw new HttpError(404, '지울 근태 기록이 없습니다.')
  const { error } = await db.from(TABLES.attendanceDays).delete().eq('id', existing.id)
  if (error) throw error
  await audit(db, profile.id, 'delete_attendance', existing.id, {
    user_id: userId,
    work_date: workDate,
    check_in_at: existing.check_in_at,
    check_out_at: existing.check_out_at,
    status: existing.attendance_status
  })
}

const kstHm = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

/* ───────── 근태통계 > 근태처리 버튼 ─────────
   출근 / 출근(지각) / 퇴근 / 퇴근(야근) 을 바로 적용한다. 이미 기록이 있으면 덮어쓰지 않고 거절한다.
   - 출근: 그날 출근 기록이 있거나 결근·휴무로 처리돼 있으면 거절
   - 퇴근: 출근 기록이 없거나, 이미 퇴근 기록이 있으면 거절(단 23:59 자동 퇴근 = 미처리 는 고칠 수 있다) */
export async function applyDay(ctx: CrmContext, userId: string, workDate: string, action: 'in' | 'in_late' | 'out' | 'out_overtime', time: string) {
  const { data: existing } = await ctx.db.from(TABLES.attendanceDays).select('*').eq('user_id', userId).eq('work_date', workDate).maybeSingle()
  if (action === 'in' || action === 'in_late') {
    if (existing?.check_in_at) throw new HttpError(409, `이미 출근 기록(${kstHm(existing.check_in_at)})이 있습니다.`)
    if (existing?.attendance_status === 'absent') throw new HttpError(409, '이미 결근으로 처리된 날입니다. 결근을 먼저 취소해 주세요.')
    if (existing?.attendance_status === 'vacation') throw new HttpError(409, '이미 휴무로 처리된 날입니다.')
  } else {
    if (!existing?.check_in_at) throw new HttpError(409, '출근 기록이 없습니다. 출근을 먼저 처리해 주세요.')
    const auto = existing.check_out_at && new Date(existing.check_out_at).getTime() === new Date(getAutoCheckoutIso(workDate)).getTime()
    if (existing.check_out_at && !auto) throw new HttpError(409, `이미 퇴근 기록(${kstHm(existing.check_out_at)})이 있습니다.`)
  }
  return resolveDay(ctx, userId, workDate, action, time, '근태처리')
}
