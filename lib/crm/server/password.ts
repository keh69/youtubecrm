import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config'
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'

// Supabase 로그인 시스템은 6자 미만 비밀번호를 받지 않는다. 회사에서 4자리 숫자 비밀번호도 쓸 수 있도록,
// 사용자가 입력한 비밀번호 앞에 고정 문자열을 붙여 Supabase에 넘긴다.
// 규칙: 비밀번호를 Supabase에 보낼 때(로그인, 계정 생성, 비밀번호 변경)는 반드시 이 함수를 거친다.
const PREFIX = 'ycrm:'

export function toAuthPassword(password: string) {
  return `${PREFIX}${password}`
}

// 로그인 확인. 이 변환을 넣기 전에 만든 계정(비밀번호가 그대로 저장됨)도 들어올 수 있게,
// 변환한 비밀번호로 실패하면 원래 비밀번호로 한 번 더 시도하고, 성공하면 새 방식으로 바꿔 저장한다.
export async function signInCompat(email: string, password: string) {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const first = await anon.auth.signInWithPassword({ email, password: toAuthPassword(password) })
  if (!first.error && first.data.session) return first.data
  if (password.length < 6) return null // Supabase는 6자 미만 원래 비밀번호를 가질 수 없다.
  const legacy = await anon.auth.signInWithPassword({ email, password })
  if (legacy.error || !legacy.data.session) return null
  await createSupabaseAdminClient().auth.admin.updateUserById(legacy.data.user.id, { password: toAuthPassword(password) })
  return legacy.data
}

export const MIN_PASSWORD = 4

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD, `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`)
  .max(64, '비밀번호가 너무 길어요.')
