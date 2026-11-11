// 스킨(디자인 버전) 목록 — 서버/클라이언트 공용.
// 직원마다 고른 스킨이 youtubeCRM_crm_users.skin 에 저장되고, 로그인하면 그 스킨 주소로 들어간다.
// 화면 주소: v1 은 루트(/attendance), 나머지는 /v{n}/attendance.

export const SKINS = [
  { key: 'v1', base: '', name: '오피스 클래식', description: '밝은 회색 바탕, 왼쪽 메뉴, 단정한 카드' },
  { key: 'v2', base: '/v2', name: '나이트 콘솔', description: '어두운 운영 콘솔, 위쪽 탭 메뉴' },
  { key: 'v3', base: '/v3', name: '페이퍼 저널', description: '신문 지면 같은 따뜻한 종이 느낌' },
  { key: 'v4', base: '/v4', name: '볼드 블록', description: '굵은 테두리와 원색 블록' },
  { key: 'v5', base: '/v5', name: '소프트 글래스', description: '파스텔 배경과 반투명 유리 카드' },
  { key: 'v6', base: '/v6', name: '심플 사이드바', description: '왼쪽 메뉴, 군더더기 없는 단색 화면' },
  { key: 'v7', base: '/v7', name: 'SQL 콘솔', description: '쿼리 편집기와 결과 그리드 느낌' },
  { key: 'v8', base: '/v8', name: '터미널', description: '검은 화면, 고정폭 글꼴, 명령줄 느낌' },
  { key: 'v9', base: '/v9', name: 'DB 관리 도구', description: '테이블 탐색기와 스키마 패널 느낌' },
  { key: 'v10', base: '/v10', name: '코드 에디터', description: '개발자 에디터(IDE) 화면 느낌' },
  { key: 'v11', base: '/v11', name: '크롬 플래그', description: '실험 기능 설정 화면(chrome://flags) 느낌' }
] as const

export type SkinKey = (typeof SKINS)[number]['key']
export const DEFAULT_SKIN: SkinKey = 'v1'

export function isSkinKey(value: unknown): value is SkinKey {
  return typeof value === 'string' && SKINS.some((s) => s.key === value)
}

export function skinBase(key: string | null | undefined) {
  return SKINS.find((s) => s.key === key)?.base ?? ''
}

// 현재 주소가 어느 스킨의 것인지 (/v10 이 /v1… 과 헷갈리지 않게 긴 것부터 비교)
export function skinOfPath(pathname: string): SkinKey {
  const found = [...SKINS]
    .filter((s) => s.base)
    .sort((a, b) => b.base.length - a.base.length)
    .find((s) => pathname === s.base || pathname.startsWith(`${s.base}/`))
  return found ? found.key : 'v1'
}

// 주소에서 스킨 부분을 뗀 나머지(/attendance 등)
export function pathWithoutSkin(pathname: string) {
  const base = skinBase(skinOfPath(pathname))
  const rest = base ? pathname.slice(base.length) : pathname
  return rest === '/' ? '' : rest
}
