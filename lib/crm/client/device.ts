// 화면 쪽 기기 판별(모든 스킨 공통): 폰·태블릿이면 출근·퇴근 버튼을 끈다. 서버도 한 번 더 막는다(lib/crm/server/device.ts).
const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as any).userAgentData
  if (uaData && typeof uaData.mobile === 'boolean' && uaData.mobile) return true
  const ua = navigator.userAgent || ''
  if (MOBILE_UA.test(ua)) return true
  // 데스크톱 모드 아이패드: 'Macintosh' 로 보이지만 터치 지점이 여러 개
  if (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true
  return false
}
