'use client'

import { useState } from 'react'
import { useMealPay, useMenuGuard } from '@/lib/crm/client/hooks'
import { fmtNumber, fmtYmdShort } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'

// 급여계산 메뉴: 위쪽 작은 탭 [급여계산] [식대계산]
//  - 급여계산: 아직 비어 있음
//  - 식대계산: 고른 달 1일~말일 출근을 누른 날 수 × 1만 원, 모든 직원 + 총 합계
const TABS = [
  { key: 'salary', label: '급여계산' },
  { key: 'meal', label: '식대계산' }
] as const
type Tab = (typeof TABS)[number]['key']

export default function V5Payroll() {
  const allowed = useMenuGuard('payroll')
  const [tab, setTab] = useState<Tab>('salary')
  if (!allowed) return null
  return (
    <>
      <PageHead emoji="💰" title="급여계산" desc="급여와 식대를 계산합니다. 식대는 그 달 1일부터 말일까지 출근을 누른 날 수 × 10,000원입니다." />
      <div className="g-seg g-payroll-tabs" role="tablist" aria-label="급여계산 메뉴" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'salary' ? <section className="g-glass" aria-label="급여계산" /> : <MealTab />}
    </>
  )
}

function MealTab() {
  const meal = useMealPay()
  const d = meal.data
  return (
    <section className="g-glass">
      <div className="g-card-head">
        <h2 className="g-h2 g-period-title">{d ? `${d.label} 식대` : '식대계산'}</h2>
        <div className="g-month-nav">
          <button className="g-btn ghost sm" onClick={() => meal.shift(-1)}>
            ◀ 이전
          </button>
          <button className="g-btn ghost sm" onClick={meal.goThisMonth}>
            이번 달
          </button>
          <button className="g-btn ghost sm" disabled={!meal.canGoNext} onClick={() => meal.shift(1)}>
            다음 ▶
          </button>
        </div>
      </div>
      {d && (
        <p className="g-muted g-small">
          {fmtYmdShort(d.from)} ~ {fmtYmdShort(d.to)} · 출근 1일당 {fmtNumber(d.perDay)}원 · 결근 처리한 날은 빼고 셉니다.
          {d.isCurrent && ` 이번 달은 오늘(${fmtYmdShort(d.countedTo)})까지 센 금액입니다.`}
        </p>
      )}
      <Note msg={meal.error ? { tone: 'error', text: meal.error } : null} role="alert" />

      {d && (
        <div className="g-totals">
          <span className="g-stat time">
            <small>식대 총 합계</small>
            <b>{fmtNumber(d.totals.amount)}원</b>
          </span>
          <span className="g-stat ok">
            <small>총 출근일</small>
            <b>{fmtNumber(d.totals.days)}일</b>
          </span>
          <span className="g-stat">
            <small>직원</small>
            <b>{d.totals.people}명</b>
          </span>
        </div>
      )}

      {meal.loading && !d ? (
        <Loading />
      ) : d && d.rows.length === 0 ? (
        <Empty>직원이 없습니다.</Empty>
      ) : d ? (
        <div className="g-table-wrap">
          <table className="g-table g-meal-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>소속</th>
                <th className="num">출근일</th>
                <th className="num">식대</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.user.id}>
                  <td className="nowrap">
                    <b>{r.user.name}</b> <span className="g-muted g-small">{r.user.loginId}</span>
                  </td>
                  <td className="nowrap">{r.user.affiliation || '-'}</td>
                  <td className="num">{fmtNumber(r.days)}일</td>
                  <td className="num">
                    <b>{fmtNumber(r.amount)}원</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>합계</th>
                <th className="num">{fmtNumber(d.totals.days)}일</th>
                <th className="num">{fmtNumber(d.totals.amount)}원</th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </section>
  )
}
