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

export async function logout() {
  await createSupabaseBrowserClient().auth.signOut()
}
