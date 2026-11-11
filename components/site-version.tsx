import { BUILD_VERSION } from '@/lib/generated-version'
import { VersionBadge } from '@/components/version-badge'

// 모든 스킨(v1~v11) 화면 맨 아래에 항상 보이는 사이트 버전. 예) 버전 2026년 11월 11일 (수) - 11
// 페이지 흐름 안의 꼬리말이라 다른 구역처럼 내용 아래에 붙는다. 색은 스킨 글자색을 흐리게 따라간다.
export function SiteVersion() {
  return (
    <footer className="site-version" aria-label="사이트 버전">
      <VersionBadge version={BUILD_VERSION} />
    </footer>
  )
}
