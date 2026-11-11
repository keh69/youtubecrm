'use client'

// v1~v11 이 모두 같이 쓰는 화면 로직(데이터 불러오기, 버튼 동작).
// 버전별 페이지는 이 훅들이 돌려주는 값으로 "모양"만 다르게 그린다.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MENUS, firstAllowedPath, type MenuKey } from '@/lib/crm/menus'
import { api, getMeCached, getToken, impersonate, loginWithId, logout as doLogout, setLoginPath } from '@/lib/crm/client/api'
import { SKINS, pathWithoutSkin, skinBase, skinOfPath, type SkinKey } from '@/lib/crm/skins'
import { addDays, monthStart, shiftMonth, todayKst, weekStart } from '@/lib/crm/client/format'
import type { AccountPatch, Me, MyAttendance, NewAccount, SettingsData, Stats, TeamAttendance, TeamPeriod, Video } from '@/lib/crm/client/types'

export type ActionResult = { ok: boolean; error?: string }

/* ───────────────────────── 세션 ───────────────────────── */

type SessionValue = { me: Me; base: string; logout: () => Promise<void>; refreshMe: () => Promise<void> }
const SessionContext = createContext<SessionValue | null>(null)

// 로그인한 사람이 처음 들어갈 주소: 그 사람이 고른 스킨의, 볼 수 있는 첫 메뉴
export function homeFor(me: Pick<Me, 'menus' | 'skin'>) {
  return firstAllowedPath(skinBase(me.skin), me.menus)
}

// 버전별 (shell) 레이아웃에서 감싼다. 로그인 안 했으면 그 버전의 로그인 화면으로 보낸다.
// 최고관리자가 아니면 자기가 고른 스킨 주소로 옮겨 준다(같은 메뉴 유지).
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

  const wrongSkin = Boolean(me && !me.isSuperAdmin && skinOfPath(pathname) !== me.skin)
  useEffect(() => {
    if (me && wrongSkin) router.replace(`${skinBase(me.skin)}${pathWithoutSkin(pathname)}` || '/')
  }, [me, wrongSkin, pathname, router])

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
    const has = (k: MenuKey) => me.menus.includes(k)
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
      router.replace(res.data.isSuperAdmin ? firstAllowedPath(base, res.data.menus) : homeFor(res.data))
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
    const res = await api(`/api/attendance/${kind === 'in' ? 'checkin' : 'checkout'}`, { method: 'POST', body: {} })
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
    canCheckIn: Boolean(data) && !today?.checkInAt && today?.status !== 'absent',
    canCheckOut: Boolean(today?.checkInAt) && !today?.checkOutAt,
    checkIn: () => press('in'),
    checkOut: () => press('out'),
    reload
  }
}

/* ───────────────────────── 직원근태 (관리자/팀장) ───────────────────────── */

export const TEAM_PERIODS: ReadonlyArray<{ key: TeamPeriod; label: string }> = [
  { key: 'week', label: '주간' },
  { key: 'month', label: '월간' }
]

// 직원근태: 주간/월간 통계. date 는 보고 있는 주/달 안의 아무 날짜.
// 집계(summary): 출근(지각 포함) / 지각(09:00 이후) / 퇴근 / 야근(19:00 이후) / 결근 / 근무시간
export function useTeamAttendance() {
  const [period, setPeriodState] = useState<TeamPeriod>('month')
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
  // 이전(-1) / 다음(+1) 주 또는 달
  const shift = (delta: number) => {
    if (period === 'week') setDate((d) => addDays(weekStart(d), delta * 7))
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

  const cancelAbsence = async (userId: string, workDate: string): Promise<ActionResult> => {
    const res = await api('/api/attendance/absence', { method: 'DELETE', body: { userId, workDate } })
    if (res.ok) await reload()
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  return { period, setPeriod, date, shift, goToday, canGoNext, data, loading, error, reload, markAbsent, cancelAbsence }
}

/* ───────────────────────── 영상등록 ───────────────────────── */

export function useVideoRegister() {
  const [stockName, setStockName] = useState('')
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
    setBusy(true)
    setError('')
    const res = await api<{ video: Video; updated: boolean }>('/api/videos/create', {
      method: 'POST',
      body: { stockName: stockName.trim(), youtubeUrl: url.trim() }
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return { ok: false, error: res.error }
    }
    setLastAdded(res.data)
    setStockName('')
    setUrl('')
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

  return { stockName, setStockName, url, setUrl, busy, error, submit, lastAdded, clearLastAdded: () => setLastAdded(null), recent, recentLoading, remove, rename }
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
  const [who, setWho] = useState('me')
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
    saveRoleMenus: (id: string, menus: MenuKey[]) => run(`/api/settings/roles/${id}`, 'PATCH', { menus }),
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

  return { items, loading, error, reload, loginAs, busyId }
}

// 설정 화면 탭(모든 스킨 공통 순서·번호)
export type SettingsTab = 'employees' | 'assign' | 'roles' | 'create'
export const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTab; no: string; label: string }> = [
  { key: 'employees', no: '01', label: '사원목록' },
  { key: 'assign', no: '02', label: '역할부여' },
  { key: 'roles', no: '03', label: '역할설정' },
  { key: 'create', no: '04', label: '아이디생성' }
]

export const EMPLOYEE_TABS_NOTE = '내 소속 하부에 있는 사원만 보입니다. "이 아이디로 로그인"을 누르면 그 사원 화면으로 바로 들어가고, 오른쪽 위 "관리자로 복귀"로 돌아옵니다.'

export const EMPTY_ACCOUNT: NewAccount = { loginId: '', password: '', name: '', email: '', phone: '', affiliationRoleId: null }

/* ───────────────────────── 내정보 (비밀번호 변경) ───────────────────────── */

// 내정보 화면 주소: 메뉴 권한과 상관없이 로그인한 사람은 누구나 들어갈 수 있다.
export const MY_PAGE_PATH = '/me'

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
    if (!current) return fail('현재 비밀번호를 입력해 주세요.')
    if (next.length < 4) return fail('새 비밀번호는 4자 이상이어야 합니다.')
    if (next !== confirm) return fail('새 비밀번호 확인이 일치하지 않습니다.')
    setBusy(true)
    setError('')
    const res = await api('/api/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
    setBusy(false)
    if (!res.ok) return fail(res.error)
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
    return { ok: true }
  }

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

/* ───────────────────────── 하단 버전·스킨 전환 (최고관리자 전용) ───────────────────────── */

export function useVersionLinks() {
  const pathname = usePathname()
  const current = skinOfPath(pathname)
  const rest = pathWithoutSkin(pathname)
  return SKINS.map((s) => ({ key: s.key, name: s.name, href: `${s.base}${rest}` || '/', active: s.key === current }))
}
