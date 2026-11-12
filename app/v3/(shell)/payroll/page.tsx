'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { PageHead } from '../../_components/ui'
import { PayrollView } from '@/components/payroll-view'

// 급여계산 메뉴: 위쪽 작은 탭 [급여계산] [식대계산] (components/payroll-view.tsx, 모든 스킨 공통)
export default function V3Payroll() {
  const allowed = useMenuGuard('payroll')
  if (!allowed) return null
  return (
    <>
      <PageHead kicker="급여 장부" title="급여계산">
        급여와 식대를 계산합니다. 식대는 그 달 1일부터 말일까지 출근을 누른 날 수 × 10,000원입니다.
      </PageHead>
      <PayrollView />
    </>
  )
}
