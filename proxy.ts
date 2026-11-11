import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_SKIN, SKIN_COOKIE, isSkinKey, skinBase } from '@/lib/crm/skins'

// 홈페이지(/)와 로그인(/login)으로 들어오면, 이 컴퓨터에 저장된 스킨(쿠키, 없으면 v5)으로 보낸다.
export function proxy(request: NextRequest) {
  const saved = request.cookies.get(SKIN_COOKIE)?.value
  const skin = isSkinKey(saved) ? saved : DEFAULT_SKIN
  const base = skinBase(skin)
  if (!base) return NextResponse.next() // v1 은 루트 주소 그대로
  const { pathname } = request.nextUrl
  const url = request.nextUrl.clone()
  url.pathname = pathname === '/login' ? `${base}/login` : base
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/', '/login']
}
