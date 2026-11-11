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

// 근태 상태 표시 이름: 미출근 / 출근(근무 중) / 퇴근 / 결근. 지각·야근은 여기서 표시하지 않는다
// (직원 본인 화면에는 지각을 띄우지 않는다. 직원근태 화면은 dayBadges 로 따로 표시).
export function statusLabel(record: { status: string; checkInAt: string | null; checkOutAt: string | null } | null | undefined) {
  if (!record) return '미출근'
  if (record.status === 'absent') return '결근'
  if (record.status === 'vacation') return '휴가'
  if (record.status === 'early_leave') return '조퇴'
  if (!record.checkInAt) return '미출근'
  return record.checkOutAt ? '퇴근' : '출근'
}

// 근태체크 "총 근무시간" 표기: 485분 → 8시간05분, 0분 → 0시간00분
export function fmtHourMin(minutes: number) {
  const m = Math.max(0, Math.floor(minutes))
  return `${Math.floor(m / 60)}시간${String(m % 60).padStart(2, '0')}분`
}

// 지금까지 일한 분: 근무 중이면 출근 시각부터 지금까지(1분마다 갱신), 퇴근했으면 기록된 값
export function liveWorkedMinutes(record: { checkInAt: string | null; checkOutAt: string | null; workedMinutes: number; status?: string } | null | undefined, now: Date = new Date()) {
  if (!record?.checkInAt || record.status === 'absent') return 0
  if (record.checkOutAt) return record.workedMinutes
  return Math.max(0, Math.floor((now.getTime() - new Date(record.checkInAt).getTime()) / 60000))
}

// 상태 색 분류: 버전마다 색은 다르게 칠하되 분류는 같게 쓴다.
export function statusTone(record: { status: string; checkInAt: string | null; checkOutAt: string | null } | null | undefined): 'none' | 'ok' | 'absent' | 'working' {
  if (!record || (!record.checkInAt && record.status !== 'absent')) return 'none'
  if (record.status === 'absent') return 'absent'
  return record.checkOutAt ? 'ok' : 'working'
}

// 직원근태(관리자) 화면 전용 표시: 09:00 이후 출근 = 지각, 19:00 이후 퇴근 = 야근,
// 퇴근을 안 눌러 23:59 에 자동 퇴근된 날 = 퇴근(미처리) (야근으로 세지 않는다)
export function dayBadges(record: { late?: boolean; overtime?: boolean; autoCheckout?: boolean } | null | undefined): Array<{ key: 'late' | 'overtime' | 'unresolved'; label: string }> {
  const out: Array<{ key: 'late' | 'overtime' | 'unresolved'; label: string }> = []
  if (record?.late) out.push({ key: 'late', label: '지각' })
  if (record?.overtime) out.push({ key: 'overtime', label: '야근' })
  if (record?.autoCheckout) out.push({ key: 'unresolved', label: '퇴근(미처리)' })
  return out
}

// 영상 형식: 10분(600초) 이상 롱폼, 미만 숏폼. 길이를 모르면 서버가 정한 값.
export function videoFormatLabel(video: { durationSeconds: number | null; contentType?: string }) {
  if (typeof video.durationSeconds === 'number') return video.durationSeconds >= 600 ? '롱폼' : '숏폼'
  return video.contentType === 'shortform' ? '숏폼' : '롱폼'
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

// 그 날짜가 들어 있는 주의 월요일 / 그 달의 1일
export function weekStart(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() // 0=일
  return addDays(ymd, -((dow + 6) % 7))
}

export function monthStart(ymd: string) {
  return `${ymd.slice(0, 7)}-01`
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1, 12))
  return date.toISOString().slice(0, 7)
}
