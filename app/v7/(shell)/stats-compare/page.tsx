'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { StatsCompareView } from '@/components/stats-compare-view'
import { SqlQuery } from '../../_ui/sql'

// 통계비교: 화면 본문은 components/stats-compare-view.tsx (모든 스킨 공용)
const QUERY = [
  '-- 두 기간, 또는 두 직원의 영상통계를 나란히 놓고 무엇이 오르고 내렸는지 봅니다.',
  'SELECT a.metric, a.value AS left_value, b.value AS right_value, b.value - a.value AS diff',
  '  FROM video_stats a',
  '  JOIN video_stats b USING (metric)',
  ' WHERE a.range = :left AND b.range = :right;'
].join('\n')

export default function V7StatsCompare() {
  const allowed = useMenuGuard('stats_compare')
  if (!allowed) return null
  return (
    <>
      <div className="page-head">
        <h1>통계비교</h1>
        <SqlQuery file="stats_compare.sql" code={QUERY} />
      </div>
      <StatsCompareView />
    </>
  )
}
