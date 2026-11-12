import type { MenuKey, SettingsSubKey } from '@/lib/crm/menus'
import type { SkinKey } from '@/lib/crm/skins'

export type Me = {
  id: string
  name: string
  loginId: string
  roles: Array<{ id: string; code: string; name: string }>
  menus: MenuKey[]
  isAdmin: boolean
  isSuperAdmin: boolean // 최고관리자(총 관리자): 하단 버전·스킨 전환 막대가 보인다
  skin: SkinKey // 이 사람이 고른 스킨(로그인하면 이 스킨 주소로 들어간다)
  settingsTabs: SettingsSubKey[] // 설정 안에서 볼 수 있는 하부 메뉴(01~07)
  canEditAttendance?: boolean // 근태통계 '수정가능': 달력에서 근태 수정·삭제
  canSeeAllStats?: boolean // 영상통계 '관리자': 전 직원 영상
  canEditVideos?: boolean // 영상등록 '수정권한'
  canDeleteVideos?: boolean // 영상등록 '수정권한'과 같다
  canEditStatsVideos?: boolean // 영상통계 '수정권한'
  workHours?: { start: string; end: string } // 출퇴근 기준시간: 이후 출근 = 지각, 이후 퇴근 = 야근
}

export type DayRecord = {
  workDate: string
  status: string // present | late | absent | not_started ...
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  absenceReason: string | null
  autoCheckout: boolean
  late: boolean // 09:00 이후 출근 (직원근태 화면에서만 표시)
  overtime: boolean // 19:00 이후 퇴근, 자동 퇴근 제외 (직원근태 화면에서만 표시)
}

export type MyAttendance = {
  today: string
  todayRecord: DayRecord | null
  history: DayRecord[]
}

// 출근 = 출근 누른 날(지각 포함), 지각 = 09:00 이후 출근, 퇴근 = 퇴근 누른 날(자동 퇴근 제외), 야근 = 19:00 이후 퇴근
export type AttendanceSummary = { present: number; late: number; checkedOut: number; overtime: number; absent: number; workedMinutes: number }

export type TeamAttendanceRow = {
  user: { id: string; name: string; loginId: string; affiliationName: string | null; roles?: string[] }
  summary: AttendanceSummary
  records: Record<string, DayRecord>
}

export type TeamPeriod = 'day' | 'week' | 'month'

export type TeamAttendance = {
  period: TeamPeriod
  date: string
  from: string
  to: string
  label: string // 예: '2026년 11월 (월간)', '2026년 11월 10일 ~ 11월 16일 (주간)'
  today: string
  isCurrent: boolean
  days: string[]
  rows: TeamAttendanceRow[]
  totals: AttendanceSummary
}

// 급여계산 > 식대계산
export type MealPay = {
  month: string // YYYY-MM
  label: string // 2026년 11월
  from: string
  to: string
  countedTo: string
  isCurrent: boolean
  perDay: number
  rows: Array<{ user: { id: string; name: string; loginId: string; affiliation: string | null; active: boolean }; days: number; amount: number }>
  totals: { days: number; amount: number; people: number }
}

// 영상등록 > 예약등록
export type Reservation = {
  id: string
  youtubeVideoId: string
  url: string
  stockName: string
  contentType: 'longform' | 'shortform'
  scheduledAt: string | null
  status: 'waiting' | 'registered'
  createdAt: string
  registeredAt: string | null
  lastCheckedAt: string | null
  videoId: string | null
}

export type Video = {
  id: string
  youtubeVideoId: string
  url: string
  stockName: string
  title: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number | null
  publishedAt: string | null
  createdAt: string
  contentType: 'longform' | 'shortform'
  ownerId: string
  ownerName?: string
}

export type Person = { id: string; name: string; loginId: string; affiliationName: string | null }

export type StatsSummary = { videoCount: number; totalViews: number; totalDurationSeconds: number }

export type Stats = {
  from: string
  to: string
  who: string
  people: Person[]
  summary: StatsSummary
  daily: Array<{ date: string; count: number; views: number }>
  perPerson: Array<StatsSummary & { userId: string; name: string }>
  videos: Video[]
}

export type SettingsRole = {
  id: string
  code: string
  name: string
  system: boolean
  locked: boolean
  menus: MenuKey[]
  settingsTabs: SettingsSubKey[] // 이 역할이 설정 안에서 볼 수 있는 하부 메뉴(01~05)
  affiliationVisible: boolean // 상세설정 '하부': 아이디 생성 소속 목록에 이 역할의 아이디가 나오는지
  signupRole?: boolean // 상세설정 '회원가입 시 역할': 새 아이디가 받는 역할(삭제 불가)
  attendanceEdit?: boolean // 근태통계 옆 '수정가능'
  statsAll?: boolean // 영상통계 옆 '관리자'
  videosEdit?: boolean // 영상등록 옆 '수정권한'
  videosDelete?: boolean // (쓰지 않음)
  statsEdit?: boolean // 영상통계 옆 '수정권한'
  holderCount: number
  memberCount: number
}

export type SettingsUser = {
  id: string
  loginId: string
  name: string
  email: string
  phone: string
  affiliationRoleId: string | null // 예전 역할 소속(호환용)
  affiliationUserId: string | null // 소속 아이디(사람)
  roleIds: string[]
  active: boolean
}

export type SettingsData = {
  roles: SettingsRole[]
  users: SettingsUser[]
  formerUsers?: Array<{ id: string; name: string }> // 삭제된 사원(소속 칸에 '홍길동(전)'으로 보이게)
  migrated: boolean
  affiliationUserReady: boolean // DB에 소속 아이디 칸이 있는지(210 SQL)
  isSuperAdmin: boolean
}

export type NewAccount = {
  loginId: string
  password: string
  name: string
  email: string
  phone: string
  affiliationRoleId: string | null // 예전 스킨 호환용
  affiliationUserId?: string | null // 소속 아이디(사람)
}

export type AccountPatch = Partial<{
  name: string
  email: string
  phone: string
  affiliationRoleId: string | null
  affiliationUserId: string | null
  password: string
  active: boolean
}>
