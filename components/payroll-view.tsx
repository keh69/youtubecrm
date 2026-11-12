'use client'

import { useState } from 'react'
import { useMealPay } from '@/lib/crm/client/hooks'
import { fmtNumber, fmtYmdShort } from '@/lib/crm/client/format'
import { cx, useSkinUi } from '@/lib/crm/client/skin-ui'

// 급여계산 메뉴 내용(모든 스킨 공통 부품, 스킨 모양은 useSkinUi). 페이지 제목은 각 스킨 페이지가 단다.
// 위쪽 작은 탭 [급여계산] [식대계산]
//  - 급여계산: 아직 비어 있음
//  - 식대계산: 고른 달 1일~말일 출근을 누른 날 수 × 1만 원, 모든 직원 + 총 합계
// v5 는 app/v5/(shell)/payroll/page.tsx 를 쓴다.
const TABS = [
  { key: 'salary', label: '급여계산' },
  { key: 'meal', label: '식대계산' }
] as const
type Tab = (typeof TABS)[number]['key']

export function PayrollView() {
  const ui = useSkinUi()
  const [tab, setTab] = useState<Tab>('salary')
  return (
    <>
      <div className="xs-bar xs-tabs" role="tablist" aria-label="급여계산 메뉴">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? ui.btnPrimary : ui.btn} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'salary' ? <section className={cx(ui.section, 'xs-panel')} aria-label="급여계산" /> : <MealTab />}
    </>
  )
}

function MealTab() {
  const ui = useSkinUi()
  const meal = useMealPay()
  const d = meal.data
  return (
    <section className={cx(ui.section, 'xs-panel')}>
      <div className="xs-head">
        <h2 className={cx(ui.h2, 'xs-h')}>{d ? `${d.label} 식대` : '식대계산'}</h2>
        <div className="xs-bar">
          <button type="button" className={ui.btn} onClick={() => meal.shift(-1)}>
            ◀ 이전
          </button>
          <button type="button" className={ui.btn} onClick={meal.goThisMonth}>
            이번 달
          </button>
          <button type="button" className={ui.btn} disabled={!meal.canGoNext} onClick={() => meal.shift(1)}>
            다음 ▶
          </button>
        </div>
      </div>
      {d && (
        <p className={ui.muted}>
          {fmtYmdShort(d.from)} ~ {fmtYmdShort(d.to)} · 출근 1일당 {fmtNumber(d.perDay)}원 · 결근 처리한 날은 빼고 셉니다.
          {d.isCurrent && ` 이번 달은 오늘(${fmtYmdShort(d.countedTo)})까지 센 금액입니다.`}
        </p>
      )}
      {meal.error && (
        <p className={ui.msgErr} role="alert">
          {meal.error}
        </p>
      )}

      {d && (
        <dl className="xs-ds-kpi xs-meal-kpi">
          <div>
            <dt>식대 총 합계</dt>
            <dd>{fmtNumber(d.totals.amount)}원</dd>
          </div>
          <div>
            <dt>총 출근일</dt>
            <dd>{fmtNumber(d.totals.days)}일</dd>
          </div>
          <div>
            <dt>직원</dt>
            <dd>{d.totals.people}명</dd>
          </div>
        </dl>
      )}

      {meal.loading && !d ? (
        <p className={ui.muted}>불러오는 중…</p>
      ) : d && d.rows.length === 0 ? (
        <p className="xs-empty">직원이 없습니다.</p>
      ) : d ? (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
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
                    <b>{r.user.name}</b> <span className={ui.muted}>{r.user.loginId}</span>
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
