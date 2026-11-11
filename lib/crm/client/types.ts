import type { MenuKey } from '@/lib/crm/menus'

export type Me = {
  id: string
  name: string
  loginId: string
  roles: Array<{ id: string; code: string; name: string }>
  menus: MenuKey[]
  isAdmin: boolean
}

export type DayRecord = {
  workDate: string
  status: string // present | late | absent | not_started ...
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  absenceReason: string | null
  autoCheckout: boolean
}

export type MyAttendance = {
  today: string
  todayRecord: DayRecord | null
  history: DayRecord[]
}

export type TeamAttendanceRow = {
  user: { id: string; name: string; loginId: string; affiliationName: string | null }
  summary: { present: number; late: number; absent: number; workedMinutes: number }
  records: Record<string, DayRecord>
}

export type TeamAttendance = {
  month: string
  today: string
  days: string[]
  rows: TeamAttendanceRow[]
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
