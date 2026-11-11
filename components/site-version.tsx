import { BUILD_VERSION } from '@/lib/generated-version'
import { VersionBadge } from '@/components/version-badge'

// 화면 오른쪽 아래(예전 v1~v11 디자인 버튼 자리)에 항상 보이는 사이트 버전. 예) 버전 2026년 11월 11일 (수) - 12
// 모든 화면·모든 사람에게 보인다. 블랙/화이트 테마에 맞춰 색이 바뀐다(globals.css .site-version).
export function SiteVersion() {
  return (
    <div className="site-version" aria-label="사이트 버전">
      <VersionBadge version={BUILD_VERSION} />
    </div>
  )
}
