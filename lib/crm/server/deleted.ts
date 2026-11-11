// 삭제된 사원 표시 규칙(서버 공용). 자세한 설명은 accounts.ts 의 softDeleteAccount 참고.
export const DELETED_STATUS = 'suspended' // DB 허용값 중 다른 곳에서 쓰지 않는 값을 '삭제됨'으로 쓴다
export const DEL_MARK = '~del~' // 삭제된 아이디 뒤에 붙는 표시(아이디 규칙상 ~ 는 사람이 쓸 수 없다)

export function isDeletedRow(u: { employment_status?: string | null }) {
  return u.employment_status === DELETED_STATUS
}
export function displayLoginId(loginId: string) {
  return String(loginId || '').split(DEL_MARK)[0]
}
export function formerName(name: string) {
  return `${name}(전)`
}
