'use client'

import { useState } from 'react'
import { fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort } from '@/lib/crm/client/format'
import { channelGroups } from '@/lib/crm/client/channels'
import type { Stats, Video } from '@/lib/crm/client/types'

// 통계비교(v5) 결과 화면: 한눈에 보기(지표 카드) · 일자별 흐름(꺾은선) · 채널별·폼종류별 · 직원별
export type Mode = 'period' | 'people'

/* ───────── 지표 계산 ───────── */
type Agg = { count: number; long: number; short: number; views: number; perDay: number; avgViews: number; maxViews: number; duration: number; avgDuration: number; likes: number; comments: number }
function agg(videos: Video[], days: number): Agg {
  const views = videos.reduce((s, v) => s + v.viewCount, 0)
  const duration = videos.reduce((s, v) => s + (v.durationSeconds || 0), 0)
  const n = videos.length
  return {
    count: n,
    long: videos.filter((v) => v.contentType === 'longform').length,
    short: videos.filter((v) => v.contentType !== 'longform').length,
    views,
    perDay: days > 0 ? Math.round(views / days) : 0,
    avgViews: n ? Math.round(views / n) : 0,
    maxViews: n ? Math.max(...videos.map((v) => v.viewCount)) : 0,
    duration,
    avgDuration: n ? Math.round(duration / n) : 0,
    likes: videos.reduce((s, v) => s + (v.likeCount || 0), 0),
    comments: videos.reduce((s, v) => s + (v.commentCount || 0), 0)
  }
}
const METRICS: Array<{ key: keyof Agg; label: string; fmt: (n: number) => string; tip?: string }> = [
  { key: 'count', label: '올린 영상', fmt: (n) => `${fmtNumber(n)}개` },
  { key: 'views', label: '총 조회수', fmt: fmtNumber, tip: '그 기간에 올린 영상들의 지금 조회수 합' },
  { key: 'perDay', label: '일 평균 조회수', fmt: fmtNumber, tip: '총 조회수 ÷ 기간 날 수' },
  { key: 'avgViews', label: '영상당 평균 조회수', fmt: fmtNumber },
  { key: 'maxViews', label: '최고 조회수', fmt: fmtNumber, tip: '가장 많이 본 영상 1개의 조회수' },
  { key: 'duration', label: '총 재생시간', fmt: (n) => fmtTotalDuration(n), tip: '올린 영상 길이의 합' },
  { key: 'avgDuration', label: '영상당 평균 길이', fmt: (n) => fmtDuration(n) },
  { key: 'long', label: '롱폼', fmt: (n) => `${fmtNumber(n)}개` },
  { key: 'short', label: '숏폼', fmt: (n) => `${fmtNumber(n)}개` },
  { key: 'likes', label: '좋아요', fmt: fmtNumber },
  { key: 'comments', label: '댓글', fmt: fmtNumber }
]

// 변화: B - A. pct 는 A 가 0 이면 null(새로 생김)
function change(a: number, b: number) {
  const diff = b - a
  const pct = a > 0 ? diff / a : null
  const dir: 'up' | 'down' | 'flat' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  return { diff, pct, dir }
}
function Delta({ a, b, fmtDiff }: { a: number; b: number; fmtDiff?: (n: number) => string }) {
  const c = change(a, b)
  const sign = c.diff > 0 ? '+' : c.diff < 0 ? '−' : ''
  const pctText = c.dir === 'flat' ? '변화 없음' : c.pct === null ? '새로 생김' : `${sign}${Math.abs(c.pct * 100).toFixed(Math.abs(c.pct) < 0.1 ? 1 : 0)}%`
  const icon = c.dir === 'up' ? '▲' : c.dir === 'down' ? '▼' : '＝'
  return (
    <span className={`cmp-delta ${c.dir}`} title={`${sign}${(fmtDiff || fmtNumber)(Math.abs(c.diff))}`}>
      <span aria-hidden="true">{icon}</span> {pctText}
    </span>
  )
}

/* ───────── 비교 결과 ───────── */
export function CompareBody({ a, b, labelA, labelB, mode, loading, onPickPerson }: { a: Stats; b: Stats; labelA: string; labelB: string; mode: Mode; loading: boolean; onPickPerson: (id: string) => void }) {
  const ga = agg(a.videos, a.daily.length)
  const gb = agg(b.videos, b.daily.length)
  const moves = METRICS.map((m) => ({ m, c: change(ga[m.key], gb[m.key]) }))
  const ups = moves.filter((x) => x.c.dir === 'up')
  const downs = moves.filter((x) => x.c.dir === 'down')
  const sameDates = mode === 'people'

  return (
    <div className={loading ? 'cmp-dim' : undefined}>
      {/* 1) 한눈에: 지표마다 A·B 막대와 오르내림 */}
      <section className="g-glass">
        <div className="g-card-head">
          <h2 className="g-h2">한눈에 보기</h2>
          <span className="cmp-legend">
            <span>
              <i className="cmp-sw a" aria-hidden="true" /> {labelA}
            </span>
            <span>
              <i className="cmp-sw b" aria-hidden="true" /> {labelB}
            </span>
          </span>
        </div>
        <p className="cmp-sum">
          <span className="cmp-delta up">▲ 오른 지표 {ups.length}개</span>
          <span className="cmp-delta down">▼ 내린 지표 {downs.length}개</span>
          <span className="g-muted">{mode === 'period' ? '비교(B) 기간이 기준(A) 기간보다' : 'B 직원이 A 직원보다'} 얼마나 오르고 내렸는지입니다.</span>
        </p>
        <div className="cmp-cards">
          {METRICS.map((m) => {
            const va = ga[m.key]
            const vb = gb[m.key]
            const max = Math.max(va, vb, 1)
            return (
              <div key={m.key} className="cmp-card">
                <div className="cmp-card-head">
                  <span title={m.tip}>{m.label}</span>
                  <Delta a={va} b={vb} fmtDiff={m.key === 'duration' ? fmtTotalDuration : m.key === 'avgDuration' ? (n) => fmtDuration(n) : undefined} />
                </div>
                <div className="cmp-bars">
                  <div className="cmp-bar a" title={`${labelA}: ${m.fmt(va)}`}>
                    <i style={{ width: `${(va / max) * 100}%` }} />
                    <b>{m.fmt(va)}</b>
                  </div>
                  <div className="cmp-bar b" title={`${labelB}: ${m.fmt(vb)}`}>
                    <i style={{ width: `${(vb / max) * 100}%` }} />
                    <b>{m.fmt(vb)}</b>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 2) 일자별 흐름 */}
      <section className="g-glass">
        <div className="g-card-head">
          <h2 className="g-h2">일자별 흐름</h2>
          <span className="g-muted">{sameDates ? '같은 날짜끼리 겹쳐 봅니다' : '두 기간을 1일째, 2일째 … 순서로 겹쳐 봅니다'} · 마우스를 올리면 그날 숫자</span>
        </div>
        <div className="cmp-charts">
          <LineCompare title="조회수" a={a.daily} b={b.daily} pick={(d) => d.views} labelA={labelA} labelB={labelB} sameDates={sameDates} />
          <LineCompare title="올린 개수" a={a.daily} b={b.daily} pick={(d) => d.count} labelA={labelA} labelB={labelB} sameDates={sameDates} unit="개" />
        </div>
      </section>

      {/* 3) 채널별 · 폼종류별 */}
      <section className="g-glass">
        <div className="g-card-head">
          <h2 className="g-h2">채널별 · 폼종류별</h2>
          <span className="g-muted">A → B 와 변화</span>
        </div>
        <GroupTable
          rows={[
            ...mergeGroups(channelGroups(a.videos), channelGroups(b.videos)).map((g) => ({ key: `c-${g.name}`, label: <span className={`vt-ch t${g.tone}`}>{g.name}</span>, a: g.a, b: g.b })),
            { key: 'f-long', label: <span className="g-format long">롱폼</span>, a: a.videos.filter((v) => v.contentType === 'longform'), b: b.videos.filter((v) => v.contentType === 'longform'), sep: true },
            { key: 'f-short', label: <span className="g-format short">숏폼</span>, a: a.videos.filter((v) => v.contentType !== 'longform'), b: b.videos.filter((v) => v.contentType !== 'longform') }
          ]}
        />
      </section>

      {/* 4) 직원별 (기간 비교 · 전체 직원일 때) */}
      {mode === 'period' && (a.perPerson.length > 0 || b.perPerson.length > 0) && <PeopleTable a={a} b={b} onPick={onPickPerson} />}
    </div>
  )
}

// 두 쪽 채널 목록을 하나로(한쪽에만 있는 채널도 0 으로 나오게). 색 차례는 두 쪽 합친 이름 순서
function mergeGroups(ga: ReturnType<typeof channelGroups>, gb: ReturnType<typeof channelGroups>) {
  const all = channelGroups([...ga.flatMap((g) => g.videos), ...gb.flatMap((g) => g.videos)])
  return all.map((g) => ({ name: g.name, tone: g.tone, a: ga.find((x) => x.name === g.name)?.videos || [], b: gb.find((x) => x.name === g.name)?.videos || [] }))
}

function GroupTable({ rows }: { rows: Array<{ key: string; label: React.ReactNode; a: Video[]; b: Video[]; sep?: boolean }> }) {
  const cols: Array<{ label: string; get: (vs: Video[]) => number; fmt: (n: number) => string }> = [
    { label: '올린 영상', get: (vs) => vs.length, fmt: (n) => `${fmtNumber(n)}개` },
    { label: '총 조회수', get: (vs) => vs.reduce((s, v) => s + v.viewCount, 0), fmt: fmtNumber },
    { label: '영상당 평균 조회수', get: (vs) => (vs.length ? Math.round(vs.reduce((s, v) => s + v.viewCount, 0) / vs.length) : 0), fmt: fmtNumber }
  ]
  return (
    <div className="g-table-wrap">
      <table className="g-table cmp-table">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {cols.map((c) => (
              <th key={c.label} scope="col" colSpan={2} className="center">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.sep ? 'sep' : undefined}>
              <th scope="row">{r.label}</th>
              {cols.map((c) => {
                const va = c.get(r.a)
                const vb = c.get(r.b)
                return [
                  <td key={`${c.label}-v`} className="num ab">
                    <span className="va">{c.fmt(va)}</span>
                    <span aria-hidden="true"> → </span>
                    <b>{c.fmt(vb)}</b>
                  </td>,
                  <td key={`${c.label}-d`} className="dl">
                    <Delta a={va} b={vb} />
                  </td>
                ]
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 직원별: 사람마다 A·B 와 조회수 변화(가운데 0 기준 막대). 이름을 누르면 그 직원만 기간 비교
function PeopleTable({ a, b, onPick }: { a: Stats; b: Stats; onPick: (id: string) => void }) {
  const [sort, setSort] = useState<'dviews' | 'views' | 'dcount' | 'name'>('dviews')
  const ids = [...new Set([...a.perPerson.map((p) => p.userId), ...b.perPerson.map((p) => p.userId)])]
  const rows = ids.map((id) => {
    const pa = a.perPerson.find((p) => p.userId === id)
    const pb = b.perPerson.find((p) => p.userId === id)
    const ca = pa?.videoCount || 0
    const cb = pb?.videoCount || 0
    const va = pa?.totalViews || 0
    const vb = pb?.totalViews || 0
    return { id, name: pa?.name || pb?.name || '-', ca, cb, va, vb, aa: ca ? Math.round(va / ca) : 0, ab: cb ? Math.round(vb / cb) : 0 }
  })
  const sorted = [...rows].sort((x, y) =>
    sort === 'name' ? x.name.localeCompare(y.name, 'ko') : sort === 'views' ? y.vb - x.vb : sort === 'dcount' ? y.cb - y.ca - (x.cb - x.ca) : y.vb - y.va - (x.vb - x.va)
  )
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.vb - r.va)))
  const up = rows.filter((r) => r.vb > r.va).length
  const down = rows.filter((r) => r.vb < r.va).length
  return (
    <section className="g-glass">
      <div className="g-card-head">
        <h2 className="g-h2">직원별</h2>
        <span className="cmp-sum">
          <span className="cmp-delta up">▲ 조회수 오른 직원 {up}명</span>
          <span className="cmp-delta down">▼ 내린 직원 {down}명</span>
          <select className="g-input sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="정렬">
            <option value="dviews">조회수 변화 큰 순</option>
            <option value="views">비교 기간 조회수 많은 순</option>
            <option value="dcount">올린 영상 변화 큰 순</option>
            <option value="name">이름 순</option>
          </select>
        </span>
      </div>
      <div className="g-table-wrap">
        <table className="g-table cmp-table cmp-people">
          <thead>
            <tr>
              <th scope="col">직원</th>
              <th scope="col" colSpan={2} className="center">
                올린 영상
              </th>
              <th scope="col" colSpan={2} className="center">
                총 조회수
              </th>
              <th scope="col" className="center">
                조회수 변화
              </th>
              <th scope="col" colSpan={2} className="center">
                영상당 평균 조회수
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const d = r.vb - r.va
              return (
                <tr key={r.id}>
                  <th scope="row">
                    <button type="button" className="cmp-name" onClick={() => onPick(r.id)} title={`${r.name}만 두 기간 비교하기`}>
                      {r.name}
                    </button>
                  </th>
                  <td className="num ab">
                    <span className="va">{fmtNumber(r.ca)}</span> → <b>{fmtNumber(r.cb)}</b>
                  </td>
                  <td className="dl">
                    <Delta a={r.ca} b={r.cb} />
                  </td>
                  <td className="num ab">
                    <span className="va">{fmtNumber(r.va)}</span> → <b>{fmtNumber(r.vb)}</b>
                  </td>
                  <td className="dl">
                    <Delta a={r.va} b={r.vb} />
                  </td>
                  <td className="cmp-div" title={`${d >= 0 ? '+' : '−'}${fmtNumber(Math.abs(d))}`}>
                    <span className="cmp-div-track">
                      <i className={d >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(d) / maxAbs) * 50}%` }} />
                    </span>
                  </td>
                  <td className="num ab">
                    <span className="va">{fmtNumber(r.aa)}</span> → <b>{fmtNumber(r.ab)}</b>
                  </td>
                  <td className="dl">
                    <Delta a={r.aa} b={r.ab} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="g-muted">이름을 누르면 그 직원만 두 기간을 비교합니다. 총 관리자(admin)는 목록에서 뺍니다.</p>
    </section>
  )
}

/* ───────── 꺾은선 비교 차트(A 회색 점선 · B 보라 실선) ───────── */
type Day = { date: string; count: number; views: number }
function LineCompare({ title, a, b, pick, labelA, labelB, sameDates, unit = '' }: { title: string; a: Day[]; b: Day[]; pick: (d: Day) => number; labelA: string; labelB: string; sameDates: boolean; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = Math.max(a.length, b.length, 1)
  const W = 560
  const H = 200
  const L = 44
  const R = 10
  const T = 12
  const Bm = 26
  const sa = a.map(pick)
  const sb = b.map(pick)
  const rawMax = Math.max(1, ...sa, ...sb)
  const step = niceStep(rawMax / 3)
  const max = Math.ceil(rawMax / step) * step
  const x = (i: number) => (n === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1))
  const y = (v: number) => T + (H - T - Bm) * (1 - v / max)
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, 1, 2, 3].map((k) => k * step).filter((v) => v <= max)
  const every = Math.max(1, Math.ceil(n / 8))
  const xLabel = (i: number) => (sameDates ? fmtYmdShort((b[i] || a[i]).date).replace(/ \(.\)$/, '') : `${i + 1}일째`)
  const fmtV = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}만` : fmtNumber(v))
  return (
    <figure className="cmp-chart">
      <figcaption>{title}</figcaption>
      <div className="cmp-chart-box" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} 일자별 비교`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="ax">
                {fmtV(v)}
              </text>
            </g>
          ))}
          {Array.from({ length: n }, (_, i) => i)
            .filter((i) => i % every === 0 || i === n - 1)
            .map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="ax">
                {xLabel(i)}
              </text>
            ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - Bm} className="cross" />}
          <path d={path(sa)} className="ln a" />
          <path d={path(sb)} className="ln b" />
          {hover !== null && hover < sa.length && <circle cx={x(hover)} cy={y(sa[hover])} r={4} className="dot a" />}
          {hover !== null && hover < sb.length && <circle cx={x(hover)} cy={y(sb[hover])} r={4} className="dot b" />}
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={x(i) - (W - L - R) / Math.max(1, n - 1) / 2} y={0} width={(W - L - R) / Math.max(1, n - 1)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="cmp-tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <b>{sameDates ? fmtYmdShort((b[hover] || a[hover]).date) : `${hover + 1}일째`}</b>
            <span>
              <i className="cmp-sw a" aria-hidden="true" /> {labelA.split(' · ')[0]}
              {a[hover] && !sameDates ? ` ${fmtYmdShort(a[hover].date)}` : ''}: {a[hover] ? `${fmtNumber(sa[hover])}${unit}` : '-'}
            </span>
            <span>
              <i className="cmp-sw b" aria-hidden="true" /> {labelB.split(' · ')[0]}
              {b[hover] && !sameDates ? ` ${fmtYmdShort(b[hover].date)}` : ''}: {b[hover] ? `${fmtNumber(sb[hover])}${unit}` : '-'}
            </span>
          </div>
        )}
      </div>
      <p className="cmp-chart-sum">
        합계 <span className="va">{fmtNumber(sa.reduce((s, v) => s + v, 0))}{unit}</span> → <b>{fmtNumber(sb.reduce((s, v) => s + v, 0))}{unit}</b> <Delta a={sa.reduce((s, v) => s + v, 0)} b={sb.reduce((s, v) => s + v, 0)} />
      </p>
    </figure>
  )
}
function niceStep(raw: number) {
  if (raw <= 1) return 1
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}
