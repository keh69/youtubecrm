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
  settingsTabs: SettingsSubKey[] // 설정 안에서 볼 수 있는 하부 메뉴(01~05)
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
  user: { id: string; name: string; loginId: string; affiliationName: string | null }
  summary: AttendanceSummary
  records: Record<string, DayRecord>
}

export type TeamPeriod = 'week' | 'month'

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
  holderCount: number
  memberCount: number
}

export type SettingsUser = {
  id: string
  loginId: string
  name: string
  email: string
  phone: string
  affiliationRoleId: string | null
  roleIds: string[]
  active: boolean
}

export type SettingsData = {
  roles: SettingsRole[]
  users: SettingsUser[]
  migrated: boolean
  isSuperAdmin: boolean
}

export type NewAccount = {
  loginId: string
  password: string
  name: string
  email: string
  phone: string
  affiliationRoleId: string | null
}

export type AccountPatch = Partial<{
  name: string
  email: string
  phone: string
  affiliationRoleId: string | null
  password: string
  active: boolean
}>
