// 메뉴 정의 (서버/클라이언트 공용).
// 역할(role)마다 어떤 메뉴를 볼 수 있는지는 youtubeCRM_role_menu_permissions 에
// (role_type = 역할 code, menu_key) 로 저장된다. 사용자가 여러 역할을 가지면 합집합.

export const MENU_KEYS = ['attendance', 'attendance_team', 'videos', 'stats', 'settings'] as const
export type MenuKey = (typeof MENU_KEYS)[number]

export const MENUS: ReadonlyArray<{ key: MenuKey; label: string; path: string; description: string }> = [
  { key: 'attendance', label: '근태체크', path: '/attendance', description: '본인 출근·퇴근 버튼' },
  { key: 'attendance_team', label: '직원근태', path: '/team-attendance', description: '직원 근태 통계 확인, 결근 처리' },
  { key: 'videos', label: '영상등록', path: '/videos', description: '종목명 + 유튜브 주소로 영상 등록' },
  { key: 'stats', label: '통계', path: '/stats', description: '영상 조회수·재생시간·업로드 현황' },
  { key: 'settings', label: '설정', path: '/settings', description: '역할부여, 역할설정, 아이디생성' }
]

// 시스템 역할: 삭제할 수 없고, 이 역할을 가진 사람은 모든 직원 데이터를 본다.
export const ADMIN_ROLE_CODES = ['super_admin', 'admin'] as const
// 총 관리자는 잠금 방지를 위해 메뉴 권한을 항상 전부 가진다(설정 화면에서 못 끈다).
export const LOCKED_ROLE_CODE = 'super_admin'
export const RETIRED_ROLE_CODE = 'retired'

export const DEFAULT_MENUS_FOR_NEW_ROLE: MenuKey[] = ['attendance', 'videos', 'stats']

export function defaultMenusForRole(code: string): MenuKey[] {
  if ((ADMIN_ROLE_CODES as readonly string[]).includes(code)) return [...MENU_KEYS]
  if (code === RETIRED_ROLE_CODE) return []
  return [...DEFAULT_MENUS_FOR_NEW_ROLE]
}

export function isMenuKey(value: string): value is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(value)
}

export function menuPath(base: string, key: MenuKey) {
  const menu = MENUS.find((m) => m.key === key)
  return `${base}${menu?.path || ''}`
}

export function firstAllowedPath(base: string, menus: string[]) {
  const first = MENUS.find((m) => menus.includes(m.key))
  return first ? `${base}${first.path}` : `${base}/login`
}
