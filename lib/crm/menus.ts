// 메뉴 정의 (서버/클라이언트 공용).
// 역할(role)마다 어떤 메뉴를 볼 수 있는지는 youtubeCRM_role_menu_permissions 에
// (role_type = 역할 code, menu_key) 로 저장된다. 사용자가 여러 역할을 가지면 합집합.

export const MENU_KEYS = ['attendance', 'attendance_team', 'videos', 'stats', 'settings'] as const
export type MenuKey = (typeof MENU_KEYS)[number]

export const MENUS: ReadonlyArray<{ key: MenuKey; label: string; path: string; description: string }> = [
  { key: 'attendance', label: '근태체크', path: '/attendance', description: '본인 출근·퇴근 버튼' },
  { key: 'attendance_team', label: '직원근태', path: '/team-attendance', description: '직원 근태 통계 확인, 결근 처리' },
  { key: 'videos', label: '영상등록', path: '/videos', description: '종목명 + 유튜브 주소로 영상 등록' },
  { key: 'stats', label: '영상통계', path: '/stats', description: '영상 조회수·재생시간·업로드 현황' },
  { key: 'settings', label: '설정', path: '/settings', description: '역할부여, 역할설정, 아이디생성' }
]

// 관리자급 역할: 이 역할을 가진 사람은 남이 등록한 영상도 고칠 수 있다. 삭제가 막힌 것은 총 관리자뿐(isSystemRole).
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

// ── 설정 안의 하부 메뉴(01~05) 권한 ──
// 역할설정 표에서 '설정'이 켜진 역할마다 [상세]로 01~05 를 보이기/안 보이기 할 수 있다.
// role_menu_permissions 에 menu_key 'settings_<key>' 로 저장. 행이 없으면 defaultOn 값을 따른다.
// 설정에 메뉴가 새로 생기면 여기에 한 줄 추가하면 역할설정 > 상세설정에 자동으로 켜기/끄기가 생긴다.
// parent 가 있는 줄은 탭이 아니라 그 탭 안의 세부 권한(부모 탭이 켜져 있을 때만 의미가 있다).
export const SETTINGS_SUBS = [
  { key: 'employees', menuKey: 'settings_employees', no: '01', label: '사원목록', parent: null, defaultOn: true },
  { key: 'employees_edit', menuKey: 'settings_employees_edit', no: '', label: '편집', parent: 'employees', defaultOn: false },
  { key: 'employees_delete', menuKey: 'settings_employees_delete', no: '', label: '삭제', parent: 'employees', defaultOn: false },
  { key: 'assign', menuKey: 'settings_assign', no: '02', label: '역할부여', parent: null, defaultOn: true },
  { key: 'roles', menuKey: 'settings_roles', no: '03', label: '역할설정', parent: null, defaultOn: true },
  { key: 'create', menuKey: 'settings_create', no: '04', label: '아이디생성', parent: null, defaultOn: true },
  { key: 'skin', menuKey: 'settings_skin', no: '05', label: '스킨', parent: null, defaultOn: true },
  { key: 'dump', menuKey: 'settings_dump', no: '06', label: '덤프파일', parent: null, defaultOn: false },
  { key: 'unresolved', menuKey: 'settings_unresolved', no: '07', label: '미처리', parent: null, defaultOn: false },
  { key: 'workhours', menuKey: 'settings_workhours', no: '08', label: '출퇴근시간', parent: null, defaultOn: false }
] as const
export type SettingsSubKey = (typeof SETTINGS_SUBS)[number]['key']
export const SETTINGS_SUB_KEYS = SETTINGS_SUBS.map((s) => s.key) as SettingsSubKey[]
// 역할설정 > 상세설정 > '하부': 켜져 있으면 아이디 생성의 소속 목록에 이 역할의 아이디가 나온다(행이 없으면 켜짐).
export const AFFILIATION_MENU_KEY = 'aff_member'
// 상세설정 '회원가입 시 역할': 이 값(can_view=true)이 붙은 역할 하나가 새 아이디(회원가입·아이디 만들기)의 기본 역할이 된다.
export const SIGNUP_ROLE_MENU_KEY = 'signup_role'
// 역할설정 표 '근태통계' 옆 '수정가능': 켜진 역할은 근태통계 달력에서 날짜를 오른쪽 클릭해 근태를 고치거나 지울 수 있다(행이 없으면 꺼짐).
export const ATTENDANCE_EDIT_MENU_KEY = 'attendance_team_edit'
// 역할설정 표 '영상통계' 옆 '관리자': 켜진 역할은 영상통계에서 모든 계정의 영상을 본다. 꺼져 있으면 나와 내 소속 하부의 영상만(행이 없으면 꺼짐).
export const STATS_ALL_MENU_KEY = 'stats_all'
// 역할설정 표 '영상등록' 옆 '수정권한'·'삭제권한': 켜진 역할만 등록한 영상의 종목명 등을 고치거나 영상을 지울 수 있다(행이 없으면 꺼짐).
export const VIDEOS_EDIT_MENU_KEY = 'videos_edit'
export const VIDEOS_DELETE_MENU_KEY = 'videos_delete' // (더 이상 쓰지 않음: 영상등록 수정권한이 수정·삭제를 함께 정한다)
// 역할설정 표 '영상통계' 옆 '수정권한': 켜진 역할은 영상통계 표에서 보이는 영상(관리자면 모든 계정, 아니면 나와 하부)을 고치거나 지울 수 있다.
export const STATS_EDIT_MENU_KEY = 'stats_edit'

// 저장된 값(없으면 기본값)으로 이 역할이 쓸 수 있는 설정 메뉴·세부 권한 목록을 만든다. 부모가 꺼진 세부 권한은 뺀다.
export function resolveSettingsSubs(stored: (menuKey: string) => boolean | undefined): SettingsSubKey[] {
  const on = new Set<string>(SETTINGS_SUBS.filter((s) => stored(s.menuKey) ?? s.defaultOn).map((s) => s.key))
  return SETTINGS_SUBS.filter((s) => on.has(s.key) && (!s.parent || on.has(s.parent))).map((s) => s.key)
}

export function isSettingsSubKey(v: string): v is SettingsSubKey {
  return (SETTINGS_SUB_KEYS as string[]).includes(v)
}
