'use client'

// v1~v11 이 모두 같이 쓰는 화면 로직(데이터 불러오기, 버튼 동작).
// 버전별 페이지는 이 훅들이 돌려주는 값으로 "모양"만 다르게 그린다.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MENUS, V5_ONLY_MENUS, firstAllowedPath, type MenuKey, type SettingsSubKey } from '@/lib/crm/menus'
import { api, getMeCached, getToken, impersonate, loginWithId, logout as doLogout, setLoginPath } from '@/lib/crm/client/api'
import { SKINS, pathWithoutSkin, readSkinCookie, skinBase, skinOfPath, writeSkinCookie, type SkinKey } from '@/lib/crm/skins'
import { addDays, monthStart, shiftMonth, todayKst, weekStart } from '@/lib/crm/client/format'
import type { AccountPatch, MealPay, Me, Reservation, MyAttendance, NewAccount, SettingsData, Stats, TeamAttendance, TeamPeriod, Video } from '@/lib/crm/client/types'
import { isMobileDevice } from '@/lib/crm/client/device'

export type ActionResult = { ok: boolean; error?: string }

/* ───────────────────────── 세션 ───────────────────────── */

type SessionValue = { me: Me; base: string; logout: () => Promise<void>; refreshMe: () => Promise<void> }
const SessionContext = createContext<SessionValue | null>(null)

// 로그인한 사람이 처음 들어갈 주소: 그 사람이 고른 스킨의, 볼 수 있는 첫 메뉴
// 스킨은 사람별이 아니라 이 컴퓨터(쿠키)별이다.
export function homeFor(me: Pick<Me, 'menus'>) {
  return firstAllowedPath(skinBase(readSkinCookie()), me.menus)
}

// 버전별 (shell) 레이아웃에서 감싼다. 로그인 안 했으면 그 버전의 로그인 화면으로 보낸다.
// 이 컴퓨터에 저장된 스킨(쿠키, 없으면 v5)과 다른 디자인 주소로 들어오면 그 스킨 주소로 옮겨 준다(같은 메뉴 유지).
export function CrmSessionProvider({ base, children, loading = null }: { base: string; children: React.ReactNode; loading?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(
    async (force = false) => {
      if (!(await getToken())) {
        router.replace(`${base}/login`)
        return
      }
      const res = await getMeCached<Me>(force)
      if (res.ok) {
        setMe(res.data)
        setError('')
      } else if (res.status === 403) {
        await doLogout()
        setError(res.error)
      } else setError(res.error)
    },
    [base, router]
  )

  useEffect(() => {
    setLoginPath(`${base}/login`)
    void load()
  }, [base, load])

  const wantSkin = me ? readSkinCookie() : null
  const wrongSkin = Boolean(me && skinOfPath(pathname) !== wantSkin)
  useEffect(() => {
    if (me && wrongSkin) router.replace(`${skinBase(wantSkin)}${pathWithoutSkin(pathname)}` || '/')
  }, [me, wrongSkin, wantSkin, pathname, router])

  const logout = useCallback(async () => {
    await doLogout()
    router.replace(`${base}/login`)
  }, [base, router])

  const refreshMe = useCallback(() => load(true), [load])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p>{error}</p>
        <a href={`${base}/login`}>로그인 화면으로</a>
      </div>
    )
  }
  if (!me || wrongSkin) return <>{loading}</>
  return <SessionContext.Provider value={{ me, base, logout, refreshMe }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession 은 CrmSessionProvider 안에서만 쓸 수 있습니다.')
  return value
}

// 페이지 맨 위에서 호출. 권한 없는 메뉴면 볼 수 있는 첫 메뉴로 보낸다. false 면 아무것도 그리지 말 것.
export function useMenuGuard(menu: MenuKey) {
  const { me, base } = useSession()
  const router = useRouter()
  const allowed = me.menus.includes(menu)
  useEffect(() => {
    if (!allowed) router.replace(firstAllowedPath(base, me.menus))
  }, [allowed, base, me.menus, router])
  return allowed
}

// 메뉴 옆에 붙는 작은 [통계] 버튼: 근태체크 옆 → 직원근태(근태통계), 영상등록 옆 → 영상통계
export type NavSub = { key: MenuKey; label: string; href: string; active: boolean }
export type NavItem = { key: MenuKey | 'skin' | 'me'; label: string; path: string; description: string; href: string; active: boolean; sub?: NavSub }

// 부모 메뉴 → 그 옆 [통계] 버튼이 여는 메뉴. 이 둘(직원근태, 영상통계)은 메뉴 줄에 따로 나오지 않는다.
// (부모 메뉴 권한이 없고 자식 권한만 있는 사람에게는 예외로 자식을 그냥 메뉴로 보여 준다.)
const NAV_SUBS: Partial<Record<MenuKey, MenuKey>> = { attendance: 'attendance_team', videos: 'stats' }
const SUB_KEYS = new Set<MenuKey>(Object.values(NAV_SUBS) as MenuKey[])

// 내 메뉴 목록(권한 있는 것만) + 현재 위치 표시. 맨 끝의 '내정보'는 누구에게나 보인다. (스킨 메뉴는 2026-11-11 메뉴에서 뺐다)
// 부모 메뉴의 active 는 [통계] 페이지에 있을 때도 켜진다.
export function useNav(): NavItem[] {
  const { me, base } = useSession()
  const pathname = usePathname()
  return useMemo(() => {
    const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
    const isV5 = base === '/v5' || base.startsWith('/v5/')
    const has = (k: MenuKey) => me.menus.includes(k) && (isV5 || !V5_ONLY_MENUS.includes(k)) // v5전용: 0 때 해제
    const items: Array<Omit<NavItem, 'href' | 'active' | 'sub'>> = [
      ...MENUS.filter((m) => has(m.key) && !(SUB_KEYS.has(m.key) && Object.entries(NAV_SUBS).some(([p, c]) => c === m.key && has(p as MenuKey)))),
      { key: 'me', label: '내정보', path: '/me', description: '내 정보 확인, 비밀번호 변경' }
    ]
    return items.map((m) => {
      const href = `${base}${m.path}`
      const childKey = NAV_SUBS[m.key as MenuKey]
      const child = childKey && has(childKey) ? MENUS.find((x) => x.key === childKey) : undefined
      const sub = child ? { key: child.key, label: '통계', href: `${base}${child.path}`, active: isOn(`${base}${child.path}`) } : undefined
      return { ...m, href, active: isOn(href) || Boolean(sub?.active), sub }
    })
  }, [base, me.menus, pathname])
}

// 버전 루트(/ 또는 /v2 ...) → 그 사람 스킨의 첫 메뉴로
export function RootRedirect({ base }: { base: string }) {
  const router = useRouter()
  useEffect(() => {
    setLoginPath(`${base}/login`)
    ;(async () => {
      if (!(await getToken())) return router.replace(`${base}/login`)
      const res = await getMeCached<Me>()
      if (!res.ok) return router.replace(`${base}/login`)
      router.replace(homeFor(res.data))
    })()
  }, [base, router])
  return null
}

/* ───────────────────────── 로그인 ───────────────────────── */

// 로그인하면 그 사람이 저장한 스킨으로 들어간다(최고관리자도 저장한 스킨으로).
export function useLogin(base: string) {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 이미 로그인 상태면 바로 들어간다.
  useEffect(() => {
    ;(async () => {
      if (await getToken()) {
        const res = await getMeCached<Me>()
        if (res.ok) router.replace(homeFor(res.data))
      }
    })()
  }, [base, router])

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy) return
    if (!loginId.trim() || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    const err = await loginWithId(loginId.trim(), password)
    if (err) {
      setError(err)
      setBusy(false)
      return
    }
    const res = await getMeCached<Me>(true)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.replace(homeFor(res.data))
  }

  return { loginId, setLoginId, password, setPassword, busy, error, submit }
}

/* ───────────────────────── 공통: 1초/30초 시계 ───────────────────────── */

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

/* ───────────────────────── 근태체크 (본인) ───────────────────────── */

export function useMyAttendance() {
  const [data, setData] = useState<MyAttendance | null>(null)
  const [mobileBlocked, setMobileBlocked] = useState(false) // 폰·태블릿이면 출근·퇴근을 막는다(컴퓨터에서만)
  useEffect(() => setMobileBlocked(isMobileDevice()), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)

  const reload = useCallback(async () => {
    const res = await api<MyAttendance>('/api/attendance/status')
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const press = async (kind: 'in' | 'out'): Promise<ActionResult> => {
    if (busy) return { ok: false }
    setBusy(kind)
    const res = await api(`/api/attendance/${kind === 'in' ? 'checkin' : 'checkout'}`, { method: 'POST', body: { device: isMobileDevice() ? 'mobile' : 'desktop' } })
    await reload()
    setBusy(null)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  const today = data?.todayRecord || null
  return {
    data,
    loading,
    error,
    busy,
    today,
    mobileBlocked,
    canCheckIn: !mobileBlocked && Boolean(data) && !today?.checkInAt && today?.status !== 'absent',
    canCheckOut: !mobileBlocked && Boolean(today?.checkInAt) && !today?.checkOutAt,
    checkIn: () => press('in'),
    checkOut: () => press('out'),
    reload
  }
}

/* ───────────────────────── 직원근태 (관리자/팀장) ───────────────────────── */

export const TEAM_PERIODS: ReadonlyArray<{ key: TeamPeriod; label: string }> = [
  { key: 'day', label: '오늘' }, // 하루(기본: 오늘)
  { key: 'week', label: '주간' },
  { key: 'month', label: '월간' }
]

// 직원근태: 주간/월간 통계. date 는 보고 있는 주/달 안의 아무 날짜.
// 집계(summary): 출근(지각 포함) / 지각(출근 기준시간 이후) / 퇴근 / 야근(퇴근 기준시간 이후) / 결근 / 근무시간
export function useTeamAttendance() {
  const [period, setPeriodState] = useState<TeamPeriod>('day') // 처음엔 오늘 하루
  const [date, setDate] = useState(() => todayKst())
  const [data, setData] = useState<TeamAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const mySeq = ++seq.current
    setLoading(true)
    const res = await api<TeamAttendance>(`/api/attendance/team?period=${period}&date=${date}`)
    if (mySeq !== seq.current) return
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [period, date])

  const setPeriod = (next: TeamPeriod) => {
    setPeriodState(next)
    setDate(todayKst())
  }
  // 이전(-1) / 다음(+1) 날·주·달
  const shift = (delta: number) => {
    if (period === 'day') setDate((d) => addDays(d, delta))
    else if (period === 'week') setDate((d) => addDays(weekStart(d), delta * 7))
    else setDate((d) => `${shiftMonth(d.slice(0, 7), delta)}-01`)
  }
  const goToday = () => setDate(todayKst())
  const canGoNext = data ? !data.isCurrent : false

  useEffect(() => {
    void reload()
  }, [reload])

  const markAbsent = async (userId: string, workDate: string, reason: string): Promise<ActionResult> => {
    const res = await api('/api/attendance/absence', { method: 'POST', body: { userId, workDate, reason } })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  // 근태처리 버튼: 출근 / 출근(지각) / 퇴근 / 퇴근(야근) (이미 기록이 있으면 서버가 거절)
  const applyDay = async (userId: string, workDate: string, action: 'in' | 'in_late' | 'out' | 'out_overtime', time: string): Promise<ActionResult> => {
    const res = await api('/api/attendance/apply', { method: 'POST', body: { userId, workDate, action, time } })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  const cancelAbsence = async (userId: string, workDate: string): Promise<ActionResult> => {
    const res = await api('/api/attendance/absence', { method: 'DELETE', body: { userId, workDate } })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  // 달력에서 하루 근태 고치기·지우기('수정가능' 권한)
  const editDay = async (body: { userId: string; workDate: string; kind: 'normal' | 'absent' | 'vacation'; checkIn: string | null; checkOut: string | null; reason: string }): Promise<ActionResult> => {
    const res = await api('/api/attendance/day', { method: 'PUT', body })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  const deleteDay = async (userId: string, workDate: string): Promise<ActionResult> => {
    const res = await api(`/api/attendance/day?userId=${userId}&workDate=${workDate}`, { method: 'DELETE' })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  return { period, setPeriod, date, shift, goToday, canGoNext, data, loading, error, reload, markAbsent, cancelAbsence, applyDay, editDay, deleteDay }
}

/* ───────────────────────── 영상등록 ───────────────────────── */

export function useVideoRegister(opts: { requireType?: boolean } = {}) {
  const [stockName, setStockName] = useState('')
  const [contentType, setContentType] = useState<'' | 'longform' | 'shortform'>('') // 롱폼/숏폼(필수인 화면에서는 꼭 골라야 추가된다)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastAdded, setLastAdded] = useState<{ video: Video; updated: boolean } | null>(null)
  const [recent, setRecent] = useState<Video[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const reloadRecent = useCallback(async () => {
    const res = await api<{ items: Video[] }>('/api/videos/mine')
    if (res.ok) setRecent(res.data.items)
    setRecentLoading(false)
  }, [])

  useEffect(() => {
    void reloadRecent()
  }, [reloadRecent])

  const submit = async (e?: React.FormEvent): Promise<ActionResult> => {
    e?.preventDefault()
    if (busy) return { ok: false }
    if (!stockName.trim()) {
      setError('종목명을 입력해 주세요.')
      return { ok: false, error: '종목명을 입력해 주세요.' }
    }
    if (!url.trim()) {
      setError('유튜브 영상 주소를 입력해 주세요.')
      return { ok: false, error: '유튜브 영상 주소를 입력해 주세요.' }
    }
    if (opts.requireType && !contentType) {
      const msg = '롱폼 또는 숏폼을 골라 주세요.'
      setError(msg)
      window.alert(msg)
      return { ok: false, error: msg }
    }
    setBusy(true)
    setError('')
    const res = await api<{ video: Video; updated: boolean }>('/api/videos/create', {
      method: 'POST',
      body: { stockName: stockName.trim(), youtubeUrl: url.trim(), ...(contentType ? { contentType } : {}) }
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return { ok: false, error: res.error }
    }
    setLastAdded(res.data)
    setStockName('')
    setUrl('')
    setContentType('')
    await reloadRecent()
    return { ok: true }
  }

  const remove = async (id: string): Promise<ActionResult> => {
    const res = await api(`/api/videos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRecent((list) => list.filter((v) => v.id !== id))
      if (lastAdded?.video.id === id) setLastAdded(null)
    }
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  const rename = async (id: string, newStockName: string): Promise<ActionResult> => {
    const res = await api<{ video: Video }>(`/api/videos/${id}`, { method: 'PATCH', body: { stockName: newStockName } })
    if (res.ok) setRecent((list) => list.map((v) => (v.id === id ? { ...v, stockName: res.data.video.stockName } : v)))
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  return { stockName, setStockName, contentType, setContentType, url, setUrl, busy, error, submit, reloadRecent, lastAdded, clearLastAdded: () => setLastAdded(null), recent, recentLoading, remove, rename }
}

// 영상 고치기(종목명·롱폼/숏폼)·지우기: 영상등록·영상통계 표가 함께 쓴다
export async function updateVideo(id: string, patch: { stockName?: string; contentType?: 'longform' | 'shortform' }): Promise<ActionResult> {
  const res = await api(`/api/videos/${id}`, { method: 'PATCH', body: patch })
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}
export async function deleteVideo(id: string): Promise<ActionResult> {
  const res = await api(`/api/videos/${id}`, { method: 'DELETE' })
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

/* ───────────────────────── 통계 ───────────────────────── */

// 기간: 오늘 / 이번주(월~오늘) / 이번달(1일~오늘) / 특정 날짜(하루). 업로드 날짜 기준.
export type StatPeriod = 'today' | 'week' | 'month' | 'date'
export const STAT_PERIODS: ReadonlyArray<{ key: StatPeriod; label: string }> = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번주' },
  { key: 'month', label: '이번달' },
  { key: 'date', label: '특정날짜' }
]

// 영상 정렬: 최신순 / 조회순 / 담당자순(담당자 이름 → 같은 담당자 안에서는 조회수 많은 순) / 길이순
export type StatSort = 'date' | 'views' | 'owner' | 'duration'
export const STAT_SORTS: ReadonlyArray<{ key: StatSort; label: string }> = [
  { key: 'date', label: '최신순' },
  { key: 'views', label: '조회순' },
  { key: 'owner', label: '담당자순' },
  { key: 'duration', label: '길이순' }
]

function periodRange(period: StatPeriod, date: string) {
  const t = todayKst()
  if (period === 'today') return { from: t, to: t }
  if (period === 'week') return { from: weekStart(t), to: t }
  if (period === 'month') return { from: monthStart(t), to: t }
  return { from: date, to: date }
}

export function useStats() {
  const [who, setWho] = useState('all') // 기본: 볼 수 있는 직원 전체(총관리자는 모든 직원, 그 외는 나 + 내 하부 직원)
  const [period, setPeriod] = useState<StatPeriod>('month')
  const [date, setDateState] = useState(() => todayKst()) // '특정날짜'일 때 고른 날짜
  const [sort, setSort] = useState<StatSort>('date')
  const { from, to } = periodRange(period, date)
  // 날짜를 고르면 자동으로 '특정날짜' 기간이 된다.
  const setDate = (ymd: string) => {
    if (!ymd) return
    setDateState(ymd)
    setPeriod('date')
  }
  const [data, setData] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const mySeq = ++seq.current
    setLoading(true)
    const res = await api<Stats>(`/api/stats?who=${encodeURIComponent(who)}&from=${from}&to=${to}`)
    if (mySeq !== seq.current) return
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [who, from, to])

  useEffect(() => {
    void reload()
  }, [reload])

  const videos = useMemo(() => {
    const list = [...(data?.videos || [])]
    const uploaded = (v: Video) => v.publishedAt || v.createdAt
    if (sort === 'views') list.sort((a, b) => b.viewCount - a.viewCount)
    else if (sort === 'duration') list.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0))
    else if (sort === 'owner') list.sort((a, b) => (a.ownerName || '').localeCompare(b.ownerName || '', 'ko') || b.viewCount - a.viewCount)
    else list.sort((a, b) => uploaded(b).localeCompare(uploaded(a)))
    return list
  }, [data, sort])

  // 볼 수 있는 사람이 나 혼자면 사람 선택 UI를 숨긴다.
  const canPickPeople = (data?.people.length || 0) > 1

  return { who, setWho, period, setPeriod, date, setDate, from, to, sort, setSort, videos, data, loading, error, reload, canPickPeople }
}

/* ───────────────────────── 설정 ───────────────────────── */

export function useSettings() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const res = await api<SettingsData>('/api/settings')
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = async (path: string, method: string, body?: unknown): Promise<ActionResult> => {
    const res = await api(path, { method, body })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  return {
    data,
    loading,
    error,
    reload,
    roleName: (id: string | null | undefined) => (id ? data?.roles.find((r) => r.id === id)?.name || '-' : '-'),
    createRole: (name: string) => run('/api/settings/roles', 'POST', { name }),
    renameRole: (id: string, name: string) => run(`/api/settings/roles/${id}`, 'PATCH', { name }),
    // 스위치가 바로 움직이도록 화면부터 바꾸고(낙관적 갱신) 서버에 저장한다. 실패하면 다시 불러와 되돌린다.
    // 설정 하부 메뉴(01~05) 보이기/안 보이기 저장 (스위치가 바로 움직이게 화면부터 바꾼다)
    saveRoleSettingsTabs: async (id: string, settingsTabs: SettingsSubKey[]): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, settingsTabs } : r)) } : d))
      const res = await api(`/api/settings/roles/${id}`, { method: 'PATCH', body: { settingsTabs } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    // 영상등록 '수정권한'·'삭제권한' 켜기/끄기
    saveRoleVideoPerm: async (id: string, field: 'videosEdit' | 'statsEdit', on: boolean): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, [field]: on } : r)) } : d))
      const res = await api(`/api/settings/roles/${id}`, { method: 'PATCH', body: { [field]: on } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    // 영상통계 '관리자' 켜기/끄기
    saveRoleStatsAll: async (id: string, statsAll: boolean): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, statsAll } : r)) } : d))
      const res = await api(`/api/settings/roles/${id}`, { method: 'PATCH', body: { statsAll } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    // 근태통계 '수정가능' 켜기/끄기
    saveRoleAttendanceEdit: async (id: string, attendanceEdit: boolean): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, attendanceEdit } : r)) } : d))
      const res = await api(`/api/settings/roles/${id}`, { method: 'PATCH', body: { attendanceEdit } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    // 상세설정 '회원가입 시 역할' 저장
    setSignupRole: async (roleId: string): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => ({ ...r, signupRole: r.id === roleId })) } : d))
      const res = await api('/api/settings/roles/signup', { method: 'PUT', body: { roleId } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    // 상세설정 '하부' 켜기/끄기 저장
    saveRoleAffiliation: async (id: string, affiliationVisible: boolean): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, affiliationVisible } : r)) } : d))
      const res = await api(`/api/settings/roles/${id}`, { method: 'PATCH', body: { affiliationVisible } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    saveRoleMenus: async (id: string, menus: MenuKey[]): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: d.roles.map((r) => (r.id === id ? { ...r, menus } : r)) } : d))
      const res = await api(`/api/settings/roles/${id}`, { method: 'PATCH', body: { menus } })
      if (!res.ok) await reload()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    deleteRole: (id: string) => run(`/api/settings/roles/${id}`, 'DELETE'),
    setUserRoles: (userId: string, roleIds: string[]) => run(`/api/settings/users/${userId}/roles`, 'PUT', { roleIds }),
    createAccount: (account: NewAccount) => run('/api/settings/users', 'POST', account),
    // 역할 순서 저장(끌어서 놓은 뒤). 화면은 먼저 바뀐 순서로 보여 주고, 실패하면 다시 불러온다.
    reorderRoles: async (roleIds: string[]): Promise<ActionResult> => {
      setData((d) => (d ? { ...d, roles: roleIds.map((id) => d.roles.find((r) => r.id === id)!).filter(Boolean) } : d))
      return run('/api/settings/roles/order', 'PUT', { roleIds })
    },
    updateAccount: (id: string, patch: AccountPatch) => run(`/api/settings/users/${id}`, 'PATCH', patch)
  }
}

/* ───────────────────────── 설정 01 사원목록 ───────────────────────── */

export type Employee = {
  id: string
  name: string
  loginId: string
  email: string
  phone: string
  affiliationName: string | null
  roles: string[]
  active: boolean
  isSuperAdmin: boolean
  hireDate: string | null // 입사일자 YYYY-MM-DD
  affiliationTitle?: string | null // 소속 직급(소속된 사람의 역할, 예: 센터장)
}

// 내 소속 하부 사원 목록 + "이 아이디로 로그인"(성공하면 그 사원의 스킨 첫 화면으로 새로 연다)
export function useEmployees() {
  const { me } = useSession()
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await api<{ items: Employee[] }>('/api/settings/employees')
    if (res.ok) {
      setItems(res.data.items)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const loginAs = async (userId: string): Promise<ActionResult> => {
    if (busyId) return { ok: false }
    setBusyId(userId)
    const err = await impersonate(userId, me.name)
    if (err) {
      setBusyId(null)
      setError(err)
      return { ok: false, error: err }
    }
    const res = await getMeCached<Me>(true)
    window.location.assign(res.ok ? homeFor(res.data) : '/login')
    return { ok: true }
  }

  // 비밀번호 초기화: 그 사원의 비밀번호를 아이디와 같게 만든다. 확인 창은 화면에서 띄운다.
  const [notice, setNotice] = useState('')
  const [resetId, setResetId] = useState<string | null>(null)
  const resetPassword = async (userId: string): Promise<ActionResult> => {
    if (resetId) return { ok: false }
    setResetId(userId)
    setNotice('')
    const res = await api<{ loginId: string }>(`/api/settings/users/${userId}/reset-password`, { method: 'POST', body: {} })
    setResetId(null)
    if (!res.ok) {
      setError(res.error)
      return { ok: false, error: res.error }
    }
    setError('')
    setNotice(`'${res.data.loginId}' 의 비밀번호를 아이디와 같게(${res.data.loginId}) 초기화했습니다.`)
    return { ok: true }
  }

  // 사원 편집(이름·이메일·전화번호)과 삭제(아이디만 지우고 영상·근태 기록은 06 덤프파일에 남긴다)
  const editEmployee = async (userId: string, body: { name: string; email: string; phone: string; hireDate: string }): Promise<ActionResult> => {
    const res = await api(`/api/settings/employees/${userId}`, { method: 'PATCH', body })
    if (!res.ok) return { ok: false, error: res.error }
    setNotice('사원 정보를 저장했습니다.')
    await reload()
    return { ok: true }
  }
  const deleteEmployee = async (userId: string, label: string): Promise<ActionResult> => {
    const res = await api(`/api/settings/employees/${userId}`, { method: 'DELETE', body: {} })
    if (!res.ok) {
      setError(res.error)
      return { ok: false, error: res.error }
    }
    setError('')
    setNotice(`${label} 아이디를 삭제했습니다. 근태·영상 기록은 06 덤프파일에 보관됩니다.`)
    await reload()
    return { ok: true }
  }

  return { items, loading, error, reload, loginAs, busyId, resetPassword, resetId, notice, editEmployee, deleteEmployee }
}

/* ───────────────────────── 출퇴근 기준시간 (설정 > 08) ───────────────────────── */
// start 이후 출근 = 지각, end 이후 퇴근 = 야근. 버튼 기본 시간: 출근 = start, 지각 = start+30분, 퇴근 = end, 야근 = end+2시간
const addMin = (hm: string, min: number) => {
  const [h, m] = hm.split(':').map(Number)
  const t = Math.min(23 * 60 + 58, h * 60 + m + min)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
export function useWorkTimes() {
  const { me } = useSession()
  const start = me.workHours?.start || '10:00'
  const end = me.workHours?.end || '19:00'
  return { start, end, defaults: { in: start, in_late: addMin(start, 30), out: end, out_overtime: addMin(end, 120) } }
}

/* ───────────────────────── 07 미처리 (근태) ───────────────────────── */
export type UnresolvedItem = { kind: 'in' | 'out'; userId: string; name: string; loginId: string; workDate: string; checkInAt: string | null }
export type UnresolvedData = { checkIn: UnresolvedItem[]; checkOut: UnresolvedItem[]; from: string; to: string }
export type ResolveAction = 'in' | 'in_late' | 'out' | 'out_overtime' | 'absent' | 'off'
export const UNRESOLVED_EVENT = 'ycrm:unresolved-changed' // 처리하면 상단 알림도 바로 다시 센다
export const SETTINGS_TAB_EVENT = 'ycrm:settings-tab' // 설정 화면에 떠 있을 때 특정 탭으로 바꾸기

export function useUnresolved() {
  const [data, setData] = useState<UnresolvedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const res = await api<UnresolvedData>('/api/settings/unresolved')
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const resolve = async (body: { userId: string; workDate: string; action: ResolveAction; time?: string | null; note?: string }): Promise<ActionResult> => {
    const res = await api('/api/settings/unresolved', { method: 'POST', body })
    if (!res.ok) return { ok: false, error: res.error }
    await reload()
    window.dispatchEvent(new Event(UNRESOLVED_EVENT))
    return { ok: true }
  }
  return { data, loading, error, reload, resolve }
}

// 상단 알림용 미처리 건수: 권한이 있을 때만 묻고, 5분마다 + 화면을 다시 볼 때 + 처리했을 때 다시 센다
export function useUnresolvedCount(enabled: boolean) {
  const [count, setCount] = useState<{ checkIn: number; checkOut: number } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = async () => {
      const res = await api<{ checkIn: number; checkOut: number }>('/api/settings/unresolved?summary=1')
      if (alive && res.ok) setCount(res.data)
    }
    void load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    const onFocus = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener(UNRESOLVED_EVENT, load)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener(UNRESOLVED_EVENT, load)
    }
  }, [enabled])
  return enabled ? count : null
}

/* ───────────────────────── 06 덤프파일 (삭제된 사원의 기록) ───────────────────────── */
export type DumpPerson = { id: string; name: string; loginId: string; deletedAt: string }
export type DumpAttendance = { userId: string; name: string; workDate: string; checkInAt: string | null; checkOutAt: string | null; status: string; absenceReason: string | null; workedMinutes: number }
export type DumpVideo = { id: string; ownerId: string; ownerName: string; stockName: string; title: string; url: string; publishedAt: string | null; createdAt: string; viewCount: number; durationSeconds: number | null; contentType: string }
export type DumpData = { people: DumpPerson[]; attendance: DumpAttendance[]; videos: DumpVideo[]; assignees: Array<{ id: string; name: string; loginId: string }> }

export function useDump() {
  const [data, setData] = useState<DumpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const res = await api<DumpData>('/api/settings/dump')
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  // 고른 영상들의 담당자를 바꾼다(바뀐 영상은 그 사원의 영상이 되어 덤프파일에서 빠진다)
  const reassign = async (videoIds: string[], ownerId: string): Promise<ActionResult & { text?: string }> => {
    const res = await api<{ count: number; ownerName: string }>('/api/settings/dump', { method: 'POST', body: { videoIds, ownerId } })
    if (!res.ok) return { ok: false, error: res.error }
    await reload()
    return { ok: true, text: `영상 ${res.data.count}개의 담당자를 ${res.data.ownerName}님으로 바꿨습니다.` }
  }
  return { data, loading, error, reload, reassign }
}

// 설정 화면 탭(모든 스킨 공통 순서·번호)
export type SettingsTab = 'employees' | 'assign' | 'roles' | 'create' | 'skin' | 'dump' | 'unresolved' | 'workhours'
export const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTab; no: string; label: string }> = [
  { key: 'employees', no: '01', label: '사원목록' },
  { key: 'assign', no: '02', label: '역할부여' },
  { key: 'roles', no: '03', label: '역할설정' },
  { key: 'create', no: '04', label: '아이디생성' },
  { key: 'skin', no: '05', label: '스킨' },
  { key: 'dump', no: '06', label: '덤프파일' },
  { key: 'unresolved', no: '07', label: '미처리' },
  { key: 'workhours', no: '08', label: '출퇴근시간' }
]

// 이 사람이 볼 수 있는 설정 탭(01~06 모두 역할별 권한) + 처음 열 탭
// 06 덤프파일·07 미처리는 화면이 있는 스킨(v5)만 opts 로 켠다.
export function useSettingsTabs(opts: { dump?: boolean; unresolved?: boolean; workhours?: boolean } = {}) {
  const { me } = useSession()
  const allowed = new Set<string>(me.settingsTabs || [])
  const tabs = SETTINGS_TABS.filter((t) => allowed.has(t.key) && (t.key !== 'dump' || opts.dump) && (t.key !== 'unresolved' || opts.unresolved) && (t.key !== 'workhours' || opts.workhours))
  return { tabs, first: (tabs[0]?.key || 'skin') as SettingsTab }
}

export const EMPLOYEE_TABS_NOTE = '내 소속 하부에 있는 사원만 보입니다(총 관리자는 하부와 상관없이 모든 사원이 보입니다). "이 아이디로 로그인"을 누르면 그 사원 화면으로 바로 들어가고, 오른쪽 위 "관리자로 복귀"로 돌아옵니다.'

export const EMPTY_ACCOUNT: NewAccount = { loginId: '', password: '', name: '', email: '', phone: '', affiliationRoleId: null }

/* ───────────────────────── 내정보 (비밀번호 변경) ───────────────────────── */

// 내정보 화면 주소: 메뉴 권한과 상관없이 로그인한 사람은 누구나 들어갈 수 있다.
export const MY_PAGE_PATH = '/me'

// 내정보 → 비밀번호 변경: 현재 비밀번호 없이 새 비밀번호(4자 이상) + 확인만 넣는다.
// 내정보: 내 전화번호·이메일 고치기(전화번호는 숫자만)
export function useMyContact() {
  const [email, setEmail] = useState('')
  const [phone, setPhoneRaw] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    void (async () => {
      const res = await api<{ email: string; phone: string }>('/api/me/contact')
      if (res.ok) {
        setEmail(res.data.email)
        setPhoneRaw(res.data.phone)
      } else setError(res.error)
      setLoading(false)
    })()
  }, [])
  const setPhone = (v: string) => setPhoneRaw(v.replace(/[^0-9]/g, '').slice(0, 11))
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setDone(false)
    const res = await api<{ email: string; phone: string }>('/api/me/contact', { method: 'PUT', body: { email: email.trim(), phone } })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setEmail(res.data.email)
    setPhoneRaw(res.data.phone)
    setDone(true)
  }
  return { email, setEmail, phone, setPhone, loading, busy, error, done, submit }
}

export function useChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e?: React.FormEvent): Promise<ActionResult> => {
    e?.preventDefault()
    if (busy) return { ok: false }
    setDone(false)
    const fail = (msg: string) => {
      setError(msg)
      return { ok: false, error: msg }
    }
    if (next.length < 4) return fail('새 비밀번호는 4자 이상이어야 합니다.')
    if (next !== confirm) return fail('새 비밀번호 확인이 일치하지 않습니다.')
    setBusy(true)
    setError('')
    const res = await api('/api/me/password', { method: 'POST', body: { newPassword: next } })
    setBusy(false)
    if (!res.ok) return fail(res.error)
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
    return { ok: true }
  }

  // current/setCurrent 는 예전 화면 호환용(이제 현재 비밀번호는 묻지 않는다)
  return { current, setCurrent, next, setNext, confirm, setConfirm, busy, error, done, submit }
}

/* ───────────────────────── 끌어서 순서 바꾸기 ───────────────────────── */

// 표의 행(tr)이나 목록 항목을 마우스로 끌어서 순서를 바꾼다.
//   const drag = useDragReorder(roles, (ids) => s.reorderRoles(ids))
//   drag.items.map((r) => <tr key={r.id} {...drag.rowProps(r.id)} className={drag.draggingId === r.id ? 'dragging' : ''}>)
// 놓는 순간(onDragEnd) 순서가 바뀌었으면 onCommit(새 id 순서)를 한 번 부른다.
export function useDragReorder<T extends { id: string }>(source: T[], onCommit: (ids: string[]) => void | Promise<unknown>) {
  const [order, setOrder] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const startOrder = useRef<string[]>([])
  const ids = order ?? source.map((x) => x.id)
  const byId = new Map(source.map((x) => [x.id, x]))
  const items = ids.map((id) => byId.get(id)).filter(Boolean) as T[]

  useEffect(() => {
    if (!draggingId) setOrder(null) // 끌기가 끝나면 서버 순서(source)를 따른다
  }, [source, draggingId])

  const rowProps = (id: string) => ({
    draggable: true,
    'aria-grabbed': draggingId === id,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      startOrder.current = source.map((x) => x.id)
      setOrder(startOrder.current)
      setDraggingId(id)
    },
    onDragOver: (e: React.DragEvent) => {
      if (!draggingId) return
      e.preventDefault()
      if (id === draggingId) return
      setOrder((cur) => {
        const list = [...(cur ?? startOrder.current)]
        const from = list.indexOf(draggingId)
        const to = list.indexOf(id)
        if (from < 0 || to < 0) return cur
        list.splice(from, 1)
        list.splice(to, 0, draggingId)
        return list
      })
    },
    onDrop: (e: React.DragEvent) => e.preventDefault(),
    onDragEnd: () => {
      const finalIds = order ?? startOrder.current
      setDraggingId(null)
      if (finalIds.join() !== startOrder.current.join()) void onCommit(finalIds)
      else setOrder(null)
    }
  })

  return { items, rowProps, draggingId }
}

/* ───────────────────────── 스킨 ───────────────────────── */

// 스킨 메뉴: 목록 + 현재 내 스킨 + 적용(저장 후 같은 메뉴의 그 스킨 화면으로 이동)
export function useSkins() {
  const { me, refreshMe } = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState<SkinKey | null>(null)
  const [error, setError] = useState('')
  const apply = async (key: SkinKey): Promise<ActionResult> => {
    if (busy) return { ok: false }
    setBusy(key)
    setError('')
    const res = await api('/api/me/skin', { method: 'PUT', body: { skin: key } })
    if (!res.ok) {
      setBusy(null)
      setError(res.error)
      return { ok: false, error: res.error }
    }
    await refreshMe()
    router.replace(`${skinBase(key)}/skin`)
    setBusy(null)
    return { ok: true }
  }
  return { skins: SKINS, current: me.skin, apply, busy, error }
}

/* ───────────────────────── 설정 05 스킨 (이 컴퓨터에 쿠키로 저장) ───────────────────────── */

export function useSkinCookie() {
  const router = useRouter()
  const pathname = usePathname()
  const [current, setCurrent] = useState<SkinKey>('v5')
  useEffect(() => setCurrent(readSkinCookie()), [])
  // 저장하면 같은 화면을 그 스킨으로 다시 연다
  const apply = (key: SkinKey) => {
    writeSkinCookie(key)
    setCurrent(key)
    router.replace(`${skinBase(key)}${pathWithoutSkin(pathname)}` || '/')
  }
  return { skins: SKINS, current, apply }
}

/* ───────────────────────── 하단 버전·스킨 전환 (예전 기능, 지금은 쓰지 않음) ───────────────────────── */

export function useVersionLinks() {
  const pathname = usePathname()
  const current = skinOfPath(pathname)
  const rest = pathWithoutSkin(pathname)
  return SKINS.map((s) => ({ key: s.key, name: s.name, href: `${s.base}${rest}` || '/', active: s.key === current }))
}

// 급여계산 > 식대계산: 고른 달(기본 이번 달)의 직원별 출근 날 수 × 1만 원
export function useMealPay() {
  const [month, setMonth] = useState(() => todayKst().slice(0, 7))
  const [data, setData] = useState<MealPay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const seq = useRef(0)
  const reload = useCallback(async () => {
    const mySeq = ++seq.current
    setLoading(true)
    const res = await api<MealPay>(`/api/payroll/meals?month=${month}`)
    if (mySeq !== seq.current) return
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [month])
  useEffect(() => {
    void reload()
  }, [reload])
  return {
    month,
    data,
    loading,
    error,
    reload,
    shift: (delta: number) => setMonth((m) => shiftMonth(m, delta)),
    goThisMonth: () => setMonth(todayKst().slice(0, 7)),
    canGoNext: month < todayKst().slice(0, 7)
  }
}

// 영상등록 > 예약등록: 내 예약 목록, 예약하기, 취소
export function useReservations() {
  const [items, setItems] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    const res = await api<{ items: Reservation[] }>('/api/videos/reservations')
    if (res.ok) {
      setItems(res.data.items)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const reserve = async (input: { youtubeUrl: string; stockName: string; contentType: 'longform' | 'shortform'; scheduledAt?: string | null }) => {
    const res = await api<{ ok: true; registered: boolean }>('/api/videos/reservations', { method: 'POST', body: input })
    if (res.ok) await reload()
    return res
  }
  const cancel = async (id: string) => {
    const res = await api<{ ok: true }>(`/api/videos/reservations/${id}`, { method: 'DELETE' })
    if (res.ok) await reload()
    return res
  }
  return { items, loading, error, reload, reserve, cancel }
}
