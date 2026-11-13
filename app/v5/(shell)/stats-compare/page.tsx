'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMenuGuard, useSession } from '@/lib/crm/client/hooks'
import { api } from '@/lib/crm/client/api'
import { addDays, fmtYmdShort, monthStart, todayKst, weekStart } from '@/lib/crm/client/format'
import type { Person, Stats } from '@/lib/crm/client/types'
import { CompareBody, type Mode } from './compare-view'
import { Loading, Note, PageHead } from '../../_components/ui'

// 통계비교(v5): 두 쪽(기준 A · 비교 B)의 영상통계를 불러 지표마다 오르고 내린 것을 차트로 비교한다.
//  - 기간 비교: 같은 대상(전체 직원 / 한 직원)의 두 기간
//  - 직원 비교: 같은 기간의 두 직원
// 조회수는 '그 기간에 올린 영상들의 지금 조회수 합'이다(영상통계와 같은 기준).

type Side = { who: string; from: string; to: string }
type Range = { from: string; to: string }

/* ───────── 날짜 도우미 ───────── */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1
const lastDayOfMonth = (ymd: string) => addDays(`${addDays(`${ymd.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1)
const shiftMonthStart = (ymd: string, delta: number) => {
  const [y, m] = ymd.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12))
  return d.toISOString().slice(0, 10)
}
const rangeText = (r: Range) => (r.from === r.to ? fmtYmdShort(r.from) : `${fmtYmdShort(r.from)} ~ ${fmtYmdShort(r.to)}`)

// 기간 비교 빠른 선택: [기준 A, 비교 B]
function periodPresets(): Array<{ key: string; label: string; a: Range; b: Range }> {
  const t = todayKst()
  const ms = monthStart(t)
  const elapsed = daysBetween(ms, t) // 이번 달 오늘까지 날 수
  const pms = shiftMonthStart(t, -1)
  const pmEnd = lastDayOfMonth(pms)
  const pmSame = addDays(pms, elapsed - 1) > pmEnd ? pmEnd : addDays(pms, elapsed - 1)
  const ws = weekStart(t)
  const lws = addDays(ws, -7)
  return [
    { key: 'm', label: '이번 달 vs 지난 달(같은 날까지)', a: { from: pms, to: pmSame }, b: { from: ms, to: t } },
    { key: 'w', label: '이번 주 vs 지난 주(같은 요일까지)', a: { from: lws, to: addDays(lws, daysBetween(ws, t) - 1) }, b: { from: ws, to: t } },
    { key: 'd7', label: '최근 7일 vs 그 전 7일', a: { from: addDays(t, -13), to: addDays(t, -7) }, b: { from: addDays(t, -6), to: t } },
    { key: 'd30', label: '최근 30일 vs 그 전 30일', a: { from: addDays(t, -59), to: addDays(t, -30) }, b: { from: addDays(t, -29), to: t } },
    { key: 'lw', label: '지난 주 vs 그 전 주', a: { from: addDays(lws, -7), to: addDays(lws, -1) }, b: { from: lws, to: addDays(ws, -1) } },
    { key: 'lm', label: '지난 달 vs 그 전 달', a: { from: shiftMonthStart(t, -2), to: lastDayOfMonth(shiftMonthStart(t, -2)) }, b: { from: pms, to: pmEnd } }
  ]
}
// 직원 비교 빠른 기간
function onePresets(): Array<{ key: string; label: string; r: Range }> {
  const t = todayKst()
  const pms = shiftMonthStart(t, -1)
  return [
    { key: 'm', label: '이번 달', r: { from: monthStart(t), to: t } },
    { key: 'pm', label: '지난 달', r: { from: pms, to: lastDayOfMonth(pms) } },
    { key: 'd7', label: '최근 7일', r: { from: addDays(t, -6), to: t } },
    { key: 'd30', label: '최근 30일', r: { from: addDays(t, -29), to: t } }
  ]
}

/* ───────── 데이터 불러오기 ───────── */
function useSideStats(side: Side | null) {
  const [state, setState] = useState<{ key: string; data: Stats | null; error: string; loading: boolean }>({ key: '', data: null, error: '', loading: true })
  const key = side ? `${side.who}|${side.from}|${side.to}` : ''
  useEffect(() => {
    if (!side) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    void (async () => {
      const res = await api<Stats>(`/api/stats?who=${encodeURIComponent(side.who)}&from=${side.from}&to=${side.to}&sync=0`)
      if (!alive) return
      setState(res.ok ? { key, data: res.data, error: '', loading: false } : { key, data: null, error: res.error, loading: false })
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

/* ───────── 화면 ───────── */
export default function V5StatsCompare() {
  const allowed = useMenuGuard('stats_compare')
  const { me } = useSession()
  const presets = useMemo(periodPresets, [])
  const ones = useMemo(onePresets, [])
  const [mode, setMode] = useState<Mode>('period')
  // 기간 비교
  const [target, setTarget] = useState('all')
  const [ra, setRa] = useState<Range>(presets[0].a)
  const [rb, setRb] = useState<Range>(presets[0].b)
  // 직원 비교
  const [pa, setPa] = useState('')
  const [pb, setPb] = useState('')
  const [rp, setRp] = useState<Range>(ones[0].r)

  const sideA: Side | null = mode === 'period' ? { who: target, ...ra } : pa ? { who: pa, ...rp } : null
  const sideB: Side | null = mode === 'period' ? { who: target, ...rb } : pb ? { who: pb, ...rp } : null
  // 사람 목록(볼 수 있는 직원): 처음엔 전체로 한 번 불러서 얻는다
  const base = useSideStats({ who: 'all', from: todayKst(), to: todayKst() })
  const A = useSideStats(sideA)
  const B = useSideStats(sideB)
  const people: Person[] = base.data?.people || []

  // 직원 비교 기본값: 볼 수 있는 직원 중 앞의 두 명
  useEffect(() => {
    if (people.length < 2) return
    if (!pa) setPa(people[0].id)
    if (!pb) setPb(people[1].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length])

  if (!allowed) return null
  const nameOf = (who: string) => (who === 'all' ? '전체 직원' : who === 'me' ? `나 (${me.name})` : people.find((p) => p.id === who)?.name || '-')
  const labelA = mode === 'period' ? `기준 · ${rangeText(ra)}` : `A · ${nameOf(pa)}`
  const labelB = mode === 'period' ? `비교 · ${rangeText(rb)}` : `B · ${nameOf(pb)}`
  const loading = A.loading || B.loading

  const personOptions = (
    <>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.loginId}){p.affiliationName ? ` · ${p.affiliationName}` : ''}
        </option>
      ))}
    </>
  )
  const rangeInputs = (r: Range, set: (r: Range) => void, aria: string) => (
    <span className="cmp-range">
      <input className="g-input g-date" type="date" value={r.from} max={todayKst()} aria-label={`${aria} 시작`} onChange={(e) => e.target.value && set({ from: e.target.value, to: e.target.value > r.to ? e.target.value : r.to })} />
      <span aria-hidden="true">~</span>
      <input className="g-input g-date" type="date" value={r.to} max={todayKst()} aria-label={`${aria} 끝`} onChange={(e) => e.target.value && set({ from: e.target.value < r.from ? e.target.value : r.from, to: e.target.value })} />
    </span>
  )

  return (
    <>
      <PageHead emoji="📈" title="통계비교" desc="두 기간, 또는 두 직원의 영상통계를 나란히 놓고 무엇이 오르고 내렸는지 봅니다. 조회수는 그 기간에 올린 영상들의 지금 조회수 합입니다." />

      <section className="g-glass cmp-controls">
        <div className="g-seg" role="group" aria-label="비교 방식">
          <button type="button" className={mode === 'period' ? 'on' : ''} aria-pressed={mode === 'period'} onClick={() => setMode('period')}>
            기간 비교
          </button>
          <button type="button" className={mode === 'people' ? 'on' : ''} aria-pressed={mode === 'people'} onClick={() => setMode('people')} disabled={people.length < 2} title={people.length < 2 ? '비교할 다른 직원이 없습니다' : undefined}>
            직원 비교
          </button>
        </div>

        {mode === 'period' ? (
          <>
            <div className="cmp-row">
              <label className="g-field">
                <span>대상</span>
                <select className="g-input" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="all">전체 직원</option>
                  {personOptions}
                </select>
              </label>
              <div className="g-field">
                <span>
                  <i className="cmp-sw a" aria-hidden="true" /> 기준 기간 (A)
                </span>
                {rangeInputs(ra, setRa, '기준 기간')}
              </div>
              <div className="g-field">
                <span>
                  <i className="cmp-sw b" aria-hidden="true" /> 비교 기간 (B)
                </span>
                {rangeInputs(rb, setRb, '비교 기간')}
              </div>
            </div>
            <div className="cmp-presets" role="group" aria-label="빠른 선택">
              {presets.map((p) => {
                const on = p.a.from === ra.from && p.a.to === ra.to && p.b.from === rb.from && p.b.to === rb.to
                return (
                  <button
                    key={p.key}
                    type="button"
                    className={`g-chip${on ? ' accent' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      setRa(p.a)
                      setRb(p.b)
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="cmp-row">
              <label className="g-field">
                <span>
                  <i className="cmp-sw a" aria-hidden="true" /> 직원 A
                </span>
                <select className="g-input" value={pa} onChange={(e) => setPa(e.target.value)}>
                  {personOptions}
                </select>
              </label>
              <label className="g-field">
                <span>
                  <i className="cmp-sw b" aria-hidden="true" /> 직원 B
                </span>
                <select className="g-input" value={pb} onChange={(e) => setPb(e.target.value)}>
                  {personOptions}
                </select>
              </label>
              <div className="g-field">
                <span>기간</span>
                {rangeInputs(rp, setRp, '기간')}
              </div>
            </div>
            <div className="cmp-presets" role="group" aria-label="빠른 기간">
              {ones.map((p) => {
                const on = p.r.from === rp.from && p.r.to === rp.to
                return (
                  <button key={p.key} type="button" className={`g-chip${on ? ' accent' : ''}`} aria-pressed={on} onClick={() => setRp(p.r)}>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
        {loading && A.data && <span className="g-spinner g-filters-spin" aria-label="새로 불러오는 중" />}
      </section>

      {(A.error || B.error) && <Note msg={{ tone: 'error', text: A.error || B.error }} role="alert" />}
      {!A.data || !B.data ? (
        <section className="g-glass">
          <Loading />
        </section>
      ) : (
        <CompareBody a={A.data} b={B.data} labelA={labelA} labelB={labelB} mode={mode} loading={loading} onPickPerson={(id) => setTarget(id)} />
      )}
    </>
  )
}

