import { TABLES } from '@/lib/supabase/tables'
import { DEFAULT_WORK_HOURS, getWorkHours, setWorkHours, type WorkHours } from '@/lib/attendance/time'
import { HttpError, isMissingSchema, type Admin } from '@/lib/crm/server/context'

// 출퇴근 기준시간(설정 > 08 출퇴근시간). 지각 = 출근 기준 이후 출근, 야근 = 퇴근 기준 이후 퇴근.
// youtubeCRM_app_settings(240 SQL) 에 저장한다. 표가 없거나 값이 없으면 기본값(10:00 · 19:00).
// 요청마다 DB 를 읽지 않도록 30초 동안 기억해 둔다(바꾸면 바로 갱신).
export const WORK_HOURS_HINT = 'DB 업데이트가 필요합니다. supabase/sql/simple/240_app_settings.sql 을 Supabase SQL Editor에서 실행해 주세요. (그 전에는 기본값 10:00 · 19:00 으로 동작합니다)'
const TTL_MS = 30 * 1000
let loadedAt = 0

export async function loadWorkHours(db: Admin, force = false): Promise<WorkHours> {
  if (!force && Date.now() - loadedAt < TTL_MS) return getWorkHours()
  const { data, error } = await db.from(TABLES.appSettings).select('key, value').in('key', ['work_start', 'work_end'])
  const map = new Map(((error ? [] : data) || []).map((r: any) => [r.key as string, r.value as string]))
  const valid = (v: string | undefined) => (v && /^\d{2}:\d{2}$/.test(v) ? v : undefined)
  setWorkHours({ start: valid(map.get('work_start')) || DEFAULT_WORK_HOURS.start, end: valid(map.get('work_end')) || DEFAULT_WORK_HOURS.end })
  loadedAt = Date.now()
  return getWorkHours()
}

export async function saveWorkHours(db: Admin, hours: WorkHours) {
  if (hours.end <= hours.start) throw new HttpError(400, '퇴근 기준시간은 출근 기준시간보다 늦어야 합니다.')
  const now = new Date().toISOString()
  const { error } = await db.from(TABLES.appSettings).upsert(
    [
      { key: 'work_start', value: hours.start, updated_at: now },
      { key: 'work_end', value: hours.end, updated_at: now }
    ],
    { onConflict: 'key' }
  )
  if (error) {
    if (isMissingSchema(error)) throw new HttpError(409, WORK_HOURS_HINT)
    throw error
  }
  return loadWorkHours(db, true)
}
