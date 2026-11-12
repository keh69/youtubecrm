'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { PayrollView } from '@/components/payroll-view'
import { SqlQuery } from '../../_ui/sql'

// 급여계산 메뉴: 위쪽 작은 탭 [급여계산] [식대계산] (내용은 모든 스킨 공통 PayrollView)
const QUERY = [
  '-- 급여와 식대를 계산합니다.',
  '-- 식대는 그 달 1일부터 말일까지 출근을 누른 날 수 × 10,000원입니다.',
  'SELECT user, COUNT(check_in) AS days, COUNT(check_in) * 10000 AS meal_pay',
  '  FROM attendance',
  ' WHERE day BETWEEN :month_first AND :month_last',
  ' GROUP BY user;'
].join('\n')

export default function V7Payroll() {
  const allowed = useMenuGuard('payroll')
  if (!allowed) return null
  return (
    <>
      <div className="page-head">
        <h1>급여계산</h1>
        <SqlQuery file="payroll.sql" code={QUERY} />
      </div>
      <PayrollView />
    </>
  )
}
