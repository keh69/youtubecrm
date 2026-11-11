import { createRemoteJWKSet, jwtVerify } from 'jose'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config'

// supabase.auth.getUser(token)는 호출마다 Supabase Auth 서버로 네트워크
// 왕복을 한다. 이 프로젝트는 비대칭키(ES256)로 로그인 토큰을 서명하므로,
// 공개 JWKS(비밀키 불필요, 누구나 조회 가능한 검증용 공개키)로 서명을 로컬에서
// 검증하면 그 왕복을 없앨 수 있다 — Supabase가 성능을 위해 공식적으로 권장하는
// 방식이다. jose가 JWKS를 메모리에 캐싱해 두고 키가 로테이션될 때만 다시
// 가져오므로, 실질적으로 요청마다 네트워크 호출이 사라진다.
//
// 트레이드오프: 서명/만료만 검증하므로, 토큰이 자연 만료(기본 1시간)되기
// 전에 관리자가 계정을 정지시켜도 그 시점까지는 이미 발급된 토큰이 계속
// 유효한 것으로 통과한다. 내부 직원용 CRM이라 감수할 수 있는 범위로 판단했다.
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

export type VerifiedTokenClaims = { sub: string; email?: string }

export async function verifyAccessToken(accessToken: string): Promise<VerifiedTokenClaims | null> {
  if (!accessToken) return null

  try {
    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`
    })
    if (!payload.sub) return null
    return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined }
  } catch {
    // 공개키(JWKS)로 확인이 안 되는 프로젝트(예전 방식 HS256 서명)를 위한 대비:
    // Supabase 로그인 서버에 직접 물어본다(요청마다 왕복 1번 더 들지만 확실하다).
    return verifyWithAuthServer(accessToken)
  }
}

async function verifyWithAuthServer(accessToken: string): Promise<VerifiedTokenClaims | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
      cache: 'no-store'
    })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: string; email?: string }
    return user.id ? { sub: user.id, email: user.email } : null
  } catch {
    return null
  }
}
