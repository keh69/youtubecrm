'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { StatsCompareView } from '@/components/stats-compare-view'
import { PageHead } from '../../_components/ui'

// 통계비교: 화면 본문은 components/stats-compare-view.tsx (모든 스킨 공용)
export default function V2StatsCompare() {
  const allowed = useMenuGuard('stats_compare')
  if (!allowed) return null
  return (
    <>
      <PageHead code="STA-02" title="통계비교" desc="두 기간, 또는 두 직원의 영상통계를 나란히 놓고 무엇이 오르고 내렸는지 봅니다." />
      <StatsCompareView />
    </>
  )
}
