import { z } from 'zod'

// Supabase 로그인 시스템은 6자 미만 비밀번호를 받지 않는다. 회사에서 4자리 숫자 비밀번호도 쓸 수 있도록,
// 사용자가 입력한 비밀번호 앞에 고정 문자열을 붙여 Supabase에 넘긴다.
// 규칙: 비밀번호를 Supabase에 보낼 때(로그인, 계정 생성, 비밀번호 변경)는 반드시 이 함수를 거친다.
const PREFIX = 'ycrm:'

export function toAuthPassword(password: string) {
  return `${PREFIX}${password}`
}

export const MIN_PASSWORD = 4

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD, `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`)
  .max(64, '비밀번호가 너무 길어요.')
