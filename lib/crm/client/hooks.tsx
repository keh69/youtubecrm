'use client'

// v1~v5 가 모두 같이 쓰는 화면 로직(데이터 불러오기, 버튼 동작).
// 버전별 페이지는 이 훅들이 돌려주는 값으로 "모양"만 다르게 그린다.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MENUS, firstAllowedPath, type MenuKey } from '@/lib/crm/menus'
import { api, getToken, loginWithId, logout as doLogout, setLoginPath } from '@/lib/crm/client/api'
import { addDays, todayKst } from '@/lib/crm/client/format'
import type { AccountPatch, Me, MyAttendance, NewAccount, SettingsData, Stats, TeamAttendance, Video } from '@/lib/crm/client/types'

export type ActionResult = { ok: boolean; error?: string }

/* ───────────────────────── 세션 ───────────────────────── */

type SessionValue = { me: Me; base: string; logout: () => Promise<void> }
const SessionContext = createContext<SessionValue | null>(null)

// 버전별 (shell) 레이아웃에서 감싼다. 로그인 안 했으면 그 버전의 로그인 화면으로 보낸다.
export function CrmSessionProvider({ base, children, loading = null }: { base: string; children: React.ReactNode; loading?: React.ReactNode }) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoginPath(`${base}/login`)
    let alive = true
    ;(async () => {
      if (!(await getToken())) {
        router.replace(`${base}/login`)
        return
      }
      const res = await api<Me>('/api/auth/me')
      if (!alive) return
      if (res.ok) setMe(res.data)
      else if (res.status === 403) {
        await doLogout()
        setError(res.error)
      } else setError(res.error)
    })()
    return () => {
      alive = false
    }
  }, [base, router])

  const logout = useCallback(async () => {
    await doLogout()
    router.replace(`${base}/login`)
  }, [base, router])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p>{error}</p>
        <a href={`${base}/login`}>로그인 화면으로</a>
      </div>
    )
  }
  if (!me) return <>{loading}</>
  return <SessionContext.Provider value={{ me, base, logout }}>{children}</SessionContext.Provider>
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

// 내 메뉴 목록(권한 있는 것만) + 현재 위치 표시
export function useNav() {
  const { me, base } = useSession()
  const pathname = usePathname()
  return useMemo(
    () =>
      MENUS.filter((m) => me.menus.includes(m.key)).map((m) => {
        const href = `${base}${m.path}`
        return { ...m, href, active: pathname === href || pathname.startsWith(`${href}/`) }
      }),
    [base, me.menus, pathname]
  )
}

// 버전 루트(/ 또는 /v2 ...) → 볼 수 있는 첫 메뉴로
export function RootRedirect({ base }: { base: string }) {
  const router = useRouter()
  useEffect(() => {
    setLoginPath(`${base}/login`)
    ;(async () => {
      if (!(await getToken())) return router.replace(`${base}/login`)
      const res = await api<Me>('/api/auth/me')
      router.replace(res.ok ? firstAllowedPath(base, res.data.menus) : `${base}/login`)
    })()
  }, [base, router])
  return null
}

/* ───────────────────────── 로그인 ───────────────────────── */

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
        const res = await api<Me>('/api/auth/me')
        if (res.ok) router.replace(firstAllowedPath(base, res.data.menus))
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
    const res = await api<Me>('/api/auth/me')
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.replace(firstAllowedPath(base, res.data.menus))
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

export function useTeamAttendance() {
  const [month, setMonth] = useState(() => todayKst().slice(0, 7))
  const [data, setData] = useState<TeamAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await api<TeamAttendance>(`/api/attendance/team?month=${month}`)
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [month])

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

  return { month, setMonth, data, loading, error, reload, markAbsent, cancelAbsence }
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

export const STAT_PRESETS = [
  { key: '7', label: '최근 7일', days: 7 },
  { key: '30', label: '최근 30일', days: 30 },
  { key: '90', label: '최근 90일', days: 90 }
] as const

export function useStats() {
  const [who, setWho] = useState('me')
  const [to, setTo] = useState(() => todayKst())
  const [from, setFrom] = useState(() => addDays(todayKst(), -29))
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

  const setRange = (nextFrom: string, nextTo: string) => {
    if (nextFrom > nextTo) [nextFrom, nextTo] = [nextTo, nextFrom]
    setFrom(nextFrom)
    setTo(nextTo)
  }
  const applyPreset = (days: number) => {
    const t = todayKst()
    setRange(addDays(t, -(days - 1)), t)
  }
  const activePreset = STAT_PRESETS.find((p) => to === todayKst() && from === addDays(to, -(p.days - 1)))?.key || null

  // 볼 수 있는 사람이 나 혼자면 사람 선택 UI를 숨긴다.
  const canPickPeople = (data?.people.length || 0) > 1

  return { who, setWho, from, to, setRange, applyPreset, activePreset, data, loading, error, reload, canPickPeople }
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
    updateAccount: (id: string, patch: AccountPatch) => run(`/api/settings/users/${id}`, 'PATCH', patch)
  }
}

export const EMPTY_ACCOUNT: NewAccount = { loginId: '', password: '', name: '', email: '', phone: '', affiliationRoleId: null }

/* ───────────────────────── 버전 전환 (비교용) ───────────────────────── */

export const VERSIONS = [
  { key: 'v1', base: '' },
  { key: 'v2', base: '/v2' },
  { key: 'v3', base: '/v3' },
  { key: 'v4', base: '/v4' },
  { key: 'v5', base: '/v5' }
] as const

export function useVersionLinks() {
  const pathname = usePathname()
  const current = VERSIONS.find((v) => v.base && (pathname === v.base || pathname.startsWith(`${v.base}/`))) || VERSIONS[0]
  const rest = current.base ? pathname.slice(current.base.length) || '' : pathname === '/' ? '' : pathname
  return VERSIONS.map((v) => ({ key: v.key, href: `${v.base}${rest}` || '/', active: v.key === current.key }))
}
