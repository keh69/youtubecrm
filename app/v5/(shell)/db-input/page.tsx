'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMenuGuard } from '@/lib/crm/client/hooks'
import { api } from '@/lib/crm/client/api'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { Loading, Note, PageHead } from '../../_components/ui'
import { DbGrid, type DbData } from './db-grid'

// 디비입력(v5): 한 달 표에 직원(세로) × 날짜(가로)로 하루 DB 개수를 직접 적는다.
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1, 12)).toISOString().slice(0, 7)
}

export default function V5DbInput() {
  const allowed = useMenuGuard('db_input')
  const thisMonth = todayKst().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<DbData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    setLoading(true)
    const res = await api<DbData>(`/api/db-counts?month=${month}`)
    if (my !== seq.current) return
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [month])
  useEffect(() => {
    void load()
  }, [load])

  // 칸 하나 저장. 성공하면 화면의 값도 바꾼다
  const save = async (userId: string, date: string, count: number | null) => {
    const res = await api(`/api/db-counts`, { method: 'PUT', body: { userId, date, count } })
    if (!res.ok) return res.error
    setData((d) =>
      d
        ? {
            ...d,
            counts: [...d.counts.filter((c) => !(c.userId === userId && c.date === date)), ...(count === null ? [] : [{ userId, date, count }])]
          }
        : d
    )
    return null
  }

  if (!allowed) return null
  const [y, m] = month.split('-').map(Number)
  const total = data?.counts.reduce((s, c) => s + c.count, 0) || 0

  return (
    <>
      <PageHead emoji="🗂️" title="디비입력" desc="직원마다 하루에 나온 DB 개수를 날짜 칸을 눌러 직접 적습니다. 적은 숫자는 영상통계·통계비교의 DB 지표에 바로 잡힙니다." />

      <section className="g-glass db-head">
        <div className="db-month" role="group" aria-label="달 고르기">
          <button type="button" className="g-btn ghost sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
            ◀
          </button>
          <b>
            {y}년 {m}월
          </b>
          <button type="button" className="g-btn ghost sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="다음 달">
            ▶
          </button>
          {month !== thisMonth && (
            <button type="button" className="g-btn ghost sm" onClick={() => setMonth(thisMonth)}>
              이번 달
            </button>
          )}
        </div>
        <span className="g-muted db-tip">칸을 누르고 숫자를 적은 뒤 Enter(다음 날로) · ↑↓(다른 직원) · 칸을 비우면 지워집니다</span>
        <span className="db-total">
          이 달 합계 <b>{fmtNumber(total)}</b>
        </span>
        {loading && data && <span className="g-spinner g-filters-spin" aria-label="불러오는 중" />}
      </section>

      {error && <Note msg={{ tone: 'error', text: error }} role="alert" />}
      {data && !data.ready && <Note msg={{ tone: 'error', text: data.hint || 'DB 표가 아직 없습니다.' }} role="alert" />}
      <section className="g-glass">
        {!data ? <Loading /> : data.people.length === 0 ? <p className="g-empty">DB를 적을 직원이 없습니다.</p> : <DbGrid key={data.month} data={data} onSave={save} />}
      </section>
    </>
  )
}
