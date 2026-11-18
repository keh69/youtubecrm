'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { StatsCompareView } from '@/components/stats-compare-view'

// 통계비교(v11): 화면 본문은 components/stats-compare-view.tsx (모든 스킨 공용)
export default function V11StatsCompare() {
  const allowed = useMenuGuard('stats_compare')
  if (!allowed) return null
  return (
    <>
      <div className="page-head">
        <h1>통계비교</h1>
        <p className="warn-banner">
          <span className="warn-ico" aria-hidden="true">
            ⚠
          </span>
          <span>두 기간, 또는 두 직원의 영상통계를 나란히 놓고 무엇이 오르고 내렸는지 봅니다. 조회수는 그 기간에 올린 영상들의 지금 조회수 합입니다.</span>
        </p>
      </div>
      <StatsCompareView />
    </>
  )
}
