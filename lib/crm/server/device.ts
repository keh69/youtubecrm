import { HttpError } from '@/lib/crm/server/context'

// 출근·퇴근은 컴퓨터에서만 누를 수 있다(폰·태블릿 막기).
// - 브라우저가 알려 주는 기기 정보(User-Agent)에 휴대기기 표시가 있거나
// - 크롬 계열이 보내는 Sec-CH-UA-Mobile: ?1 이거나
// - 화면 쪽에서 터치 전용 기기(예: 데스크톱 모드로 바꾼 아이패드)라고 알려 오면 막는다.
// 폰에서 '데스크톱 버전 보기' 같은 기능으로 기기 정보를 일부러 바꾸면 완전히 막을 수는 없다.
const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i

export function isMobileRequest(request: Request, clientSaysMobile?: boolean) {
  const ua = request.headers.get('user-agent') || ''
  const chMobile = request.headers.get('sec-ch-ua-mobile') === '?1'
  return MOBILE_UA.test(ua) || chMobile || Boolean(clientSaysMobile)
}

export function assertDesktop(request: Request, clientSaysMobile?: boolean) {
  if (isMobileRequest(request, clientSaysMobile)) {
    throw new HttpError(403, 'PC에서만 근태체크가 가능합니다.')
  }
}
