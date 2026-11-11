// 화면 표시용 포맷터 (모든 버전 공용). 시간은 모두 한국 시간(KST) 기준.

const KST = 'Asia/Seoul'

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: KST, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

export function fmtTimeSec(iso: string | null | undefined) {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: KST, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso))
}

// 2026-11-11 → 11.11 (수)
export function fmtYmdShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const wd = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, weekday: 'short' }).format(new Date(Date.UTC(y, m - 1, d, 12)))
  return `${m}.${d} (${wd})`
}

// ISO → 2026.11.11
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '-'
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
  return parts.replace(/-/g, '.')
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '-'
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

// 영상 길이: 75 → 1:15, 3725 → 1:02:05
export function fmtDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// 합계 시간: 3725초 → 1시간 2분
export function fmtTotalDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}분`
  return `${h}시간 ${m}분`
}

export function fmtMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export function fmtNumber(n: number | null | undefined) {
  return new Intl.NumberFormat('ko-KR').format(Number(n || 0))
}

// 근태 상태 표시 이름
export function statusLabel(record: { status: string; checkInAt: string | null; checkOutAt: string | null } | null | undefined) {
  if (!record) return '미출근'
  if (record.status === 'absent') return '결근'
  if (record.status === 'vacation') return '휴가'
  if (record.status === 'early_leave') return '조퇴'
  if (!record.checkInAt) return '미출근'
  const late = record.status === 'late'
  if (record.checkOutAt) return late ? '지각·퇴근' : '퇴근'
  return late ? '지각·근무중' : '근무중'
}

// 상태 색 분류: 버전마다 색은 다르게 칠하되 분류는 같게 쓴다.
export function statusTone(record: { status: string; checkInAt: string | null; checkOutAt: string | null } | null | undefined): 'none' | 'ok' | 'late' | 'absent' | 'working' {
  if (!record || (!record.checkInAt && record.status !== 'absent')) return 'none'
  if (record.status === 'absent') return 'absent'
  if (!record.checkOutAt) return record.status === 'late' ? 'late' : 'working'
  return record.status === 'late' ? 'late' : 'ok'
}

export function todayKst() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function addDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1, 12))
  return date.toISOString().slice(0, 7)
}
