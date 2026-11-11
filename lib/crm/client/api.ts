'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

let loginPath = '/login'
export function setLoginPath(path: string) {
  loginPath = path
}

export async function getToken() {
  const { data } = await createSupabaseBrowserClient().auth.getSession()
  return data.session?.access_token || null
}

// 모든 API 호출은 이 함수로. 로그인 만료(401)면 해당 버전의 로그인 화면으로 보낸다.
export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const token = await getToken()
  if (!token) {
    if (typeof window !== 'undefined') window.location.replace(loginPath)
    return { ok: false, status: 401, error: '로그인이 필요합니다.' }
  }
  try {
    const res = await fetch(path, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401 && typeof window !== 'undefined') {
      await createSupabaseBrowserClient().auth.signOut()
      window.location.replace(loginPath)
    }
    if (!res.ok) return { ok: false, status: res.status, error: data?.error || '요청을 처리하지 못했습니다.' }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, status: 0, error: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.' }
  }
}

export async function loginWithId(loginId: string, password: string): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return data?.error || '로그인에 실패했습니다.'
    const { error } = await createSupabaseBrowserClient().auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken
    })
    return error ? '로그인 세션을 저장하지 못했습니다.' : null
  } catch {
    return '서버에 연결할 수 없습니다.'
  }
}

// 로그아웃하면 보관 중이던 관리자 세션(사원 아이디로 들어간 경우)도 함께 지운다.
export async function logout() {
  meCache = null
  clearImpersonation()
  await createSupabaseBrowserClient().auth.signOut({ scope: 'local' })
}

// /api/auth/me 결과를 잠깐(15초) 같이 쓴다: 화면 틀과 하단 전환 막대가 각자 부르지 않게.
let meCache: { token: string; at: number; promise: Promise<ApiResult<any>> } | null = null
export async function getMeCached<T = any>(force = false): Promise<ApiResult<T>> {
  const token = await getToken()
  if (!token) return { ok: false, status: 401, error: '로그인이 필요합니다.' }
  if (!force && meCache && meCache.token === token && Date.now() - meCache.at < 15000) return meCache.promise
  const promise = api<T>('/api/auth/me')
  meCache = { token, at: Date.now(), promise }
  const res = await promise
  if (!res.ok) meCache = null
  return res
}
export function clearMeCache() {
  meCache = null
}

/* ── 사원 아이디로 로그인 / 관리자로 복귀 ── */
// 관리자 세션을 브라우저(localStorage)에 잠시 보관하고 사원 세션으로 바꾼다. '관리자로 복귀'를 누르면 되돌린다.
const IMPERSONATION_KEY = 'ycrm_impersonation'

export type ImpersonationInfo = { adminAccess: string; adminRefresh: string; adminName: string; targetName: string; targetLoginId: string }

export function getImpersonation(): ImpersonationInfo | null {
  try {
    const raw = window.localStorage.getItem(IMPERSONATION_KEY)
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null
  } catch {
    return null
  }
}

export async function impersonate(userId: string, adminName: string): Promise<string | null> {
  const supabase = createSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session) return '로그인이 필요합니다.'
  const res = await api<{ accessToken: string; refreshToken: string; target: { name: string; loginId: string } }>('/api/settings/impersonate', {
    method: 'POST',
    body: { userId }
  })
  if (!res.ok) return res.error
  const info: ImpersonationInfo = {
    adminAccess: data.session.access_token,
    adminRefresh: data.session.refresh_token,
    adminName,
    targetName: res.data.target.name,
    targetLoginId: res.data.target.loginId
  }
  try {
    window.localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(info))
  } catch {
    return '브라우저 저장소를 쓸 수 없어 전환할 수 없습니다.'
  }
  const { error } = await supabase.auth.setSession({ access_token: res.data.accessToken, refresh_token: res.data.refreshToken })
  meCache = null
  return error ? '사원 세션으로 바꾸지 못했습니다.' : null
}

export async function returnToAdmin(): Promise<string | null> {
  const info = getImpersonation()
  if (!info) return '돌아갈 관리자 세션이 없습니다.'
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.auth.setSession({ access_token: info.adminAccess, refresh_token: info.adminRefresh })
  try {
    window.localStorage.removeItem(IMPERSONATION_KEY)
  } catch {}
  meCache = null
  return error ? '관리자 세션이 만료되었습니다. 다시 로그인해 주세요.' : null
}

export function clearImpersonation() {
  try {
    window.localStorage.removeItem(IMPERSONATION_KEY)
  } catch {}
}
