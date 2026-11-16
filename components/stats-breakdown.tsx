'use client'

import { useMemo, useState } from 'react'
import { fmtNumber } from '@/lib/crm/client/format'
import type { Stats, Video } from '@/lib/crm/client/types'

// 영상통계(v5) 추가 표: 종목별 · 러닝타임별.
// DB 는 '디비입력'에 직원·날짜로만 적으므로 종목·영상별 실제 DB 는 알 수 없다.
// 그래서 '추정 DB' = 직원마다 그 기간 DB 를 그 직원 영상들의 조회수 비중으로 나눠 붙인 값(조회수가 많은 영상에 DB 가 많이 나왔다고 보는 추정).

type Group = { key: string; label: string; videos: Video[]; order?: number }
type Row = { key: string; label: string; count: number; long: number; short: number; views: number; avg: number; max: number; db: number; order: number }
type SortKey = 'label' | 'count' | 'views' | 'avg' | 'max' | 'db' | 'dbPer' | 'dbRate'
// 머리칸 정렬: 누를 때마다 내림차순 → 오름차순 → 기본 정렬(null)
type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null
const nextSort = (s: Sort, k: SortKey): Sort => (!s || s.key !== k ? { key: k, dir: 'desc' } : s.dir === 'desc' ? { key: k, dir: 'asc' } : null)
const val = (r: Row, k: SortKey) => (k === 'dbPer' ? (r.count ? r.db / r.count : 0) : k === 'dbRate' ? (r.views ? r.db / r.views : 0) : k === 'label' ? 0 : (r[k] as number))

// 영상 1개당 추정 DB
function dbShare(videos: Video[], db: Stats['db']): Map<string, number> {
  const out = new Map<string, number>()
  if (!db?.ready) return out
  const byUser = new Map<string, Video[]>()
  for (const v of videos) byUser.set(v.ownerId, [...(byUser.get(v.ownerId) || []), v])
  for (const p of db.perPerson) {
    const list = byUser.get(p.userId) || []
    if (!list.length || !p.count) continue
    const views = list.reduce((s, v) => s + v.viewCount, 0)
    for (const v of list) out.set(v.id, views > 0 ? (p.count * v.viewCount) / views : p.count / list.length)
  }
  return out
}

function toRows(groups: Group[], share: Map<string, number>): Row[] {
  return groups.map((g) => {
    const views = g.videos.reduce((s, v) => s + v.viewCount, 0)
    return {
      key: g.key,
      label: g.label,
      order: g.order ?? 0,
      count: g.videos.length,
      long: g.videos.filter((v) => v.contentType === 'longform').length,
      short: g.videos.filter((v) => v.contentType !== 'longform').length,
      views,
      avg: g.videos.length ? Math.round(views / g.videos.length) : 0,
      max: g.videos.length ? Math.max(...g.videos.map((v) => v.viewCount)) : 0,
      db: g.videos.reduce((s, v) => s + (share.get(v.id) || 0), 0)
    }
  })
}

// 러닝타임 구간
const BUCKETS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: 'b0', label: '1분 미만', min: 0, max: 60 },
  { key: 'b1', label: '1~3분', min: 60, max: 180 },
  { key: 'b2', label: '3~5분', min: 180, max: 300 },
  { key: 'b3', label: '5~10분', min: 300, max: 600 },
  { key: 'b4', label: '10~15분', min: 600, max: 900 },
  { key: 'b5', label: '15~20분', min: 900, max: 1200 },
  { key: 'b6', label: '20~30분', min: 1200, max: 1800 },
  { key: 'b7', label: '30분 이상', min: 1800, max: Infinity }
]

/* ───────── 종목별 ───────── */
export function StatsByStock({ st }: { st: { data: Stats | null } }) {
  const videos = st.data?.videos || []
  const hasDb = Boolean(st.data?.db?.ready)
  const share = useMemo(() => dbShare(videos, st.data?.db), [videos, st.data?.db])
  const rows = useMemo(() => {
    const map = new Map<string, Video[]>()
    for (const v of videos) map.set(v.stockName || '-', [...(map.get(v.stockName || '-') || []), v])
    return toRows([...map].map(([k, list]) => ({ key: k, label: k, videos: list })), share)
  }, [videos, share])
  const [sort, setSort] = useState<Sort>(null) // 기본: 총 조회수 많은 순
  const [all, setAll] = useState(false)
  const [q, setQ] = useState('')
  if (!videos.length) return null
  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const shown = sortRows(rows, sort, (a, b) => b.views - a.views).filter((r) => !q.trim() || r.label.toLowerCase().includes(q.trim().toLowerCase()))
  const list = all || q.trim() ? shown : shown.slice(0, 10)
  const maxViews = Math.max(1, ...rows.map((r) => r.views))
  return (
    <section className="g-glass">
      <div className="g-card-head">
        <h2 className="g-h2">종목별</h2>
        <span className="bd-tools">
          <input className="g-input sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="종목 찾기" aria-label="종목 찾기" />
          <span className="g-muted">종목 {fmtNumber(rows.length)}개</span>
        </span>
      </div>
      <div className="g-table-wrap">
        <table className="g-table bd-table">
          <thead>
            <tr>
              <SortTh k="label" label="종목" sort={sort} set={setSort} />
              <SortTh k="count" label="영상" sort={sort} set={setSort} num title="올린 영상 수 (롱폼 / 숏폼)" />
              <SortTh k="views" label="총 조회수" sort={sort} set={setSort} num />
              <th scope="col">조회수 비중</th>
              <SortTh k="avg" label="평균 조회수" sort={sort} set={setSort} num title="영상 1개당 평균 조회수" />
              <SortTh k="max" label="최고 조회수" sort={sort} set={setSort} num />
              {hasDb && <SortTh k="db" label="추정 DB" sort={sort} set={setSort} num title="직원별 DB를 그 직원 영상들의 조회수 비중으로 나눈 추정값" />}
              {hasDb && <SortTh k="dbRate" label="조회수 대비 DB" sort={sort} set={setSort} num title="추정 DB ÷ 총 조회수 × 100" />}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.key}>
                <th scope="row">
                  <span className="g-chip accent">{r.label}</span>
                </th>
                <td className="num">
                  <b>{fmtNumber(r.count)}</b>
                  <small className="bd-sub">
                    {r.long}/{r.short}
                  </small>
                </td>
                <td className="num">
                  <b>{fmtNumber(r.views)}</b>
                </td>
                <td className="bd-barcell" title={`${totalViews ? ((r.views / totalViews) * 100).toFixed(1) : 0}%`}>
                  <span className="bd-bar">
                    <i style={{ width: `${(r.views / maxViews) * 100}%` }} />
                  </span>
                  <span className="bd-pct">{totalViews ? `${Math.round((r.views / totalViews) * 100)}%` : '-'}</span>
                </td>
                <td className="num">{fmtNumber(r.avg)}</td>
                <td className="num">{fmtNumber(r.max)}</td>
                {hasDb && <td className="num">{r.db ? r.db.toFixed(1) : '-'}</td>}
                {hasDb && <td className="num bd-muted">{r.views > 0 && r.db ? `${((r.db / r.views) * 100).toFixed(2)}%` : '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bd-foot">
        {!q.trim() && shown.length > 10 && (
          <button type="button" className="g-btn ghost sm" onClick={() => setAll(!all)}>
            {all ? '10개만 보기' : `전체 ${fmtNumber(shown.length)}개 보기`}
          </button>
        )}
        <span className="g-muted g-small">머리칸을 누를 때마다 내림차순 → 오름차순 → 기본 정렬(총 조회수 많은 순)로 바뀝니다.{hasDb ? ' 추정 DB는 직원별 DB를 그 직원 영상들의 조회수 비중으로 나눈 값입니다(종목별 실제 DB는 따로 적지 않으므로 추정).' : ''}</span>
      </div>
    </section>
  )
}

/* ───────── 러닝타임별 ───────── */
export function StatsByRuntime({ st }: { st: { data: Stats | null } }) {
  const videos = st.data?.videos || []
  const hasDb = Boolean(st.data?.db?.ready)
  const share = useMemo(() => dbShare(videos, st.data?.db), [videos, st.data?.db])
  const rows = useMemo(() => {
    const groups: Group[] = BUCKETS.map((b, i) => ({ key: b.key, label: b.label, order: i, videos: videos.filter((v) => v.durationSeconds != null && v.durationSeconds >= b.min && v.durationSeconds < b.max) }))
    const unknown = videos.filter((v) => v.durationSeconds == null)
    if (unknown.length) groups.push({ key: 'na', label: '길이 모름', order: 99, videos: unknown })
    return toRows(groups, share).filter((r) => r.count > 0)
  }, [videos, share])
  const [sort, setSort] = useState<Sort>({ key: 'dbPer', dir: 'desc' }) // 처음: 영상당 DB 많은 순(누르면 오름차순 → 길이 순)
  if (!videos.length) return null
  const sorted = sortRows(rows, sort, (a, b) => a.order - b.order)
  const maxAvg = Math.max(1, ...rows.map((r) => r.avg))
  const maxCount = Math.max(1, ...rows.map((r) => r.count))
  const best = rows.reduce<Row | null>((b, r) => (r.count >= 3 && (!b || r.avg > b.avg) ? r : b), null)
  return (
    <section className="g-glass">
      <div className="g-card-head">
        <h2 className="g-h2">러닝타임별</h2>
        {best && (
          <span className="bd-best">
            영상당 평균 조회수가 가장 높은 길이: <b>{best.label}</b> ({fmtNumber(best.avg)})
          </span>
        )}
      </div>
      <div className="g-table-wrap">
        <table className="g-table bd-table bd-runtime">
          <thead>
            <tr>
              <SortTh k="label" label="러닝타임" sort={sort} set={setSort} title="기본 정렬: 짧은 길이부터" />
              <SortTh k="count" label="영상" sort={sort} set={setSort} num title="올린 영상 수 (롱폼 / 숏폼)" />
              <th scope="col">영상 수</th>
              <SortTh k="views" label="총 조회수" sort={sort} set={setSort} num />
              <SortTh k="avg" label="영상당 평균 조회수" sort={sort} set={setSort} num />
              <th scope="col">평균 비교</th>
              <SortTh k="max" label="최고 조회수" sort={sort} set={setSort} num />
              {hasDb && <SortTh k="db" label="추정 DB" sort={sort} set={setSort} num title="직원별 DB를 그 직원 영상들의 조회수 비중으로 나눈 추정값" />}
              {hasDb && <SortTh k="dbPer" label="영상당 DB" sort={sort} set={setSort} num title="추정 DB ÷ 영상 수" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.key} className={best?.key === r.key ? 'best' : undefined}>
                <th scope="row">{r.label}</th>
                <td className="num">
                  <b>{fmtNumber(r.count)}</b>
                  <small className="bd-sub">
                    {r.long}/{r.short}
                  </small>
                </td>
                <td className="bd-barcell">
                  <span className="bd-bar soft">
                    <i style={{ width: `${(r.count / maxCount) * 100}%` }} />
                  </span>
                </td>
                <td className="num">{fmtNumber(r.views)}</td>
                <td className="num">
                  <b>{fmtNumber(r.avg)}</b>
                </td>
                <td className="bd-barcell">
                  <span className="bd-bar">
                    <i style={{ width: `${(r.avg / maxAvg) * 100}%` }} />
                  </span>
                </td>
                <td className="num">{fmtNumber(r.max)}</td>
                {hasDb && <td className="num">{r.db ? r.db.toFixed(1) : '-'}</td>}
                {hasDb && <td className="num bd-dbper">{r.count && r.db ? (r.db / r.count).toFixed(2) : '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="g-muted g-small">영상 길이로 나눠서 어떤 길이의 영상이 조회수가 잘 나오는지 봅니다. 영상 3개 이상인 구간 중 영상당 평균 조회수가 가장 높은 줄이 강조됩니다. 처음에는 영상당 DB 많은 순이고, 머리칸을 누를 때마다 내림차순 → 오름차순 → 기본 정렬(짧은 길이부터)로 바뀝니다.</p>
    </section>
  )
}

// sort 가 없으면 기본 정렬(base). 러닝타임 줄은 길이 순서(order), 종목은 이름순
function sortRows(rows: Row[], sort: Sort, base: (a: Row, b: Row) => number) {
  if (!sort) return [...rows].sort(base)
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const d = sort.key === 'label' ? (a.order !== b.order ? a.order - b.order : a.label.localeCompare(b.label, 'ko')) : val(a, sort.key) - val(b, sort.key)
    return d * sign || base(a, b)
  })
}

function SortTh({ k, label, sort, set, num, title }: { k: SortKey; label: string; sort: Sort; set: (s: Sort) => void; num?: boolean; title?: string }) {
  const on = sort?.key === k
  return (
    <th scope="col" className={num ? 'num' : undefined} title={title} aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`vt-sort${on ? ' on' : ''}`} onClick={() => set(nextSort(sort, k))}>
        {label}
        <span className="vt-sort-ico" aria-hidden="true">
          {on ? (sort!.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  )
}
