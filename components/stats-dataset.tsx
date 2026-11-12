'use client'

import { useMemo, useState } from 'react'
import { fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort } from '@/lib/crm/client/format'
import type { Video } from '@/lib/crm/client/types'
import type { useStats } from '@/lib/crm/client/hooks'
import { cx, useSkinUi } from '@/lib/crm/client/skin-ui'

// 영상통계 수치표 묶음(모든 스킨 공통 부품): 요약 한 줄 · 일자별 표 · 담당자별 표.
// v5 는 예전 class(g-ds-*) 그대로, 다른 스킨은 그 스킨의 카드·표 모양(useSkinUi) + xs-ds-* 배치로 그린다.
type St = ReturnType<typeof useStats>

/* ───────── 요약 한 줄 ───────── */
export function StatsKpiSection({ st }: { st: St }) {
  const ui = useSkinUi()
  const v5 = ui.key === 'v5'
  const s = st.data?.summary
  const rangeText = st.from === st.to ? fmtYmdShort(st.from) : `${fmtYmdShort(st.from)} ~ ${fmtYmdShort(st.to)}`
  const list = st.data?.videos || []
  const days = st.data?.daily.length || 0 // 기간 날 수(서버가 기간의 날짜마다 한 줄씩 준다)
  return (
    <section className={v5 ? 'g-glass g-ds-kpi' : cx(ui.section, 'xs-panel')} aria-label="기간 요약">
      <dl className={v5 ? undefined : 'xs-ds-kpi'}>
        <div>
          <dt>기간</dt>
          <dd className="small">{rangeText}</dd>
        </div>
        <div>
          <dt>올린 영상</dt>
          <dd>{fmtNumber(s?.videoCount)}개</dd>
        </div>
        <div>
          <dt>총 조회수</dt>
          <dd>{fmtNumber(s?.totalViews)}</dd>
        </div>
        {v5 && ( // v5전용: 0 때 해제 — 일 평균 조회수(총 조회수 ÷ 기간 날 수)
          <div>
            <dt title="총 조회수 ÷ 기간 날 수(이번 달·이번 주는 오늘까지)">일 평균 조회수</dt>
            <dd>{s && days > 0 ? fmtNumber(Math.round(s.totalViews / days)) : '-'}</dd>
          </div>
        )}
        <div>
          <dt>영상당 평균 조회수</dt>
          <dd>{s && s.videoCount > 0 ? fmtNumber(Math.round(s.totalViews / s.videoCount)) : '-'}</dd>
        </div>
        <div>
          <dt>총 재생시간(영상 길이 합)</dt>
          <dd>{fmtTotalDuration(s?.totalDurationSeconds || 0)}</dd>
        </div>
        <div>
          <dt>영상당 평균 길이</dt>
          <dd>{s && s.videoCount > 0 ? fmtDuration(Math.round(s.totalDurationSeconds / s.videoCount)) : '-'}</dd>
        </div>
        <div>
          <dt>롱폼 / 숏폼</dt>
          <dd>
            {fmtNumber(list.filter((v) => v.contentType === 'longform').length)} / {fmtNumber(list.filter((v) => v.contentType !== 'longform').length)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/* ───────── 일자별 표: 날짜를 가로로, 올린 개수·조회수를 줄로. 개수 칸은 많을수록 진한 보라(한 색 농도) ───────── */
const weekdayOf = (ymd: string) => ['일', '월', '화', '수', '목', '금', '토'][new Date(`${ymd}T12:00:00Z`).getUTCDay()]
const isWeekend = (ymd: string) => {
  const w = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return w === 0 || w === 6
}
// 1만 이상은 1.2만처럼 줄여 좁은 칸에 들어가게
const shortNum = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString('ko-KR'))

// onPickDay: 올린 개수 칸을 누르면 그날(YYYY-MM-DD)을 알려 준다(영상리스트를 그날로 거르기). pickedDay: 지금 고른 날(칸 강조)
export function StatsDailySection({ st, onPickDay, pickedDay }: { st: St; onPickDay?: (ymd: string) => void; pickedDay?: string | null }) {
  const ui = useSkinUi()
  const v5 = ui.key === 'v5'
  const daily = st.data?.daily || []
  if (daily.length === 0) return null
  const maxCount = Math.max(1, ...daily.map((d) => d.count))
  return (
    <section className={v5 ? 'g-glass' : cx(ui.section, 'xs-panel')}>
      <h2 className={v5 ? 'g-h2' : cx(ui.h2, 'xs-h')}>일자별</h2>
      <div className={ui.tableWrap}>
        <table className={v5 ? 'g-table g-ds-daily' : cx(ui.table, 'xs-ds-daily')}>
          <thead>
            <tr>
              <th scope="col">날짜</th>
              {daily.map((d) => (
                <th key={d.date} scope="col" className={isWeekend(d.date) ? 'we' : undefined} title={fmtYmdShort(d.date)}>
                  {Number(d.date.slice(8))}
                  <small>{weekdayOf(d.date)}</small>
                </th>
              ))}
              <th scope="col" className="sum">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">올린 개수</th>
              {daily.map((d) => (
                <td
                  key={d.date}
                  className={d.count > 0 ? (d.count / maxCount > 0.55 ? 'heat hi' : 'heat') : 'zero'}
                  style={d.count > 0 ? { ['--a' as string]: (0.18 + 0.62 * (d.count / maxCount)).toFixed(2) } : undefined}
                  title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}
                >
                  {d.count > 0 ? (
                    onPickDay ? (
                      <button type="button" className={`ds-cell ds-pick${pickedDay === d.date ? ' on' : ''}`} onClick={() => onPickDay(d.date)} title={`${fmtYmdShort(d.date)} 올린 영상 ${d.count}개만 아래 영상리스트에 보기`}>
                        {d.count}
                      </button>
                    ) : (
                      <span className="ds-cell">{d.count}</span>
                    )
                  ) : (
                    '·'
                  )}
                </td>
              ))}
              <td className="sum">{fmtNumber(daily.reduce((n, d) => n + d.count, 0))}</td>
            </tr>
            <tr>
              <th scope="row">조회수</th>
              {daily.map((d) => (
                <td key={d.date} className={d.views > 0 ? undefined : 'zero'} title={`${fmtYmdShort(d.date)} · 조회수 ${fmtNumber(d.views)}`}>
                  {d.views > 0 ? shortNum(d.views) : '·'}
                </td>
              ))}
              <td className="sum">{shortNum(daily.reduce((n, d) => n + d.views, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={ui.muted}>
        올린 개수 칸은 그날 올린 영상이 많을수록 진하게 보입니다. 조회수는 그날 올린 영상들의 지금 조회수 합입니다. 칸에 마우스를 올리면 자세히 보입니다.
        {onPickDay && ' 올린 개수 칸을 누르면 아래 영상리스트가 그날 올린 영상으로 걸러집니다.'}
      </p>
    </section>
  )
}

/* ───────── 담당자별 ───────── */
export function StatsPersonSection({ st, meId }: { st: St; meId: string }) {
  const ui = useSkinUi()
  const v5 = ui.key === 'v5'
  if (!st.data || st.data.perPerson.length === 0) return null
  return (
    <section className={v5 ? 'g-glass' : cx(ui.section, 'xs-panel')}>
      <div className={v5 ? 'g-card-head' : 'xs-head'}>
        <h2 className={v5 ? 'g-h2' : cx(ui.h2, 'xs-h')}>담당자별</h2>
        <span className={ui.muted}>머리칸을 누르면 정렬 · [보기]를 누르면 그 사람 영상만</span>
      </div>
      <PersonStatsTable people={st.data.perPerson} videos={st.data.videos} onPick={(id) => st.setWho(id === meId ? 'me' : id)} />
    </section>
  )
}

// 담당자별 표: 사람마다 영상 수·조회수·재생시간과 평균·최고·비중을 한눈에 보는 수치표.
// 머리칸을 누르면 오름차순 → 내림차순 → 기본(조회수 많은 순) 으로 정렬된다. 맨 아래 줄은 합계·전체 평균.
type Person = { userId: string; name: string }
type Row = {
  userId: string
  name: string
  count: number
  long: number
  short: number
  views: number
  avgViews: number | null
  maxViews: number | null
  duration: number
  avgDuration: number | null
  likes: number
  share: number // 전체 조회수 중 이 사람 비중(0~1)
  last: string | null // 가장 최근 올린 시각(ISO)
}
type Key = 'name' | 'count' | 'views' | 'share' | 'avgViews' | 'maxViews' | 'duration' | 'avgDuration' | 'likes' | 'last'
type Sort = { key: Key; dir: 'asc' | 'desc' } | null

const uploaded = (v: Video) => v.publishedAt || v.createdAt
// 11.12 (목)
const shortDay = (iso: string | null) => {
  if (!iso) return '-'
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  )
  return `${p.month}.${p.day} (${p.weekday})`
}

function build(people: Person[], videos: Video[]): Row[] {
  const totalViews = videos.reduce((n, v) => n + v.viewCount, 0)
  return people.map((p) => {
    const list = videos.filter((v) => v.ownerId === p.userId)
    const views = list.reduce((n, v) => n + v.viewCount, 0)
    const duration = list.reduce((n, v) => n + (v.durationSeconds || 0), 0)
    const withDur = list.filter((v) => v.durationSeconds != null)
    return {
      userId: p.userId,
      name: p.name,
      count: list.length,
      long: list.filter((v) => v.contentType === 'longform').length,
      short: list.filter((v) => v.contentType !== 'longform').length,
      views,
      avgViews: list.length ? Math.round(views / list.length) : null,
      maxViews: list.length ? Math.max(...list.map((v) => v.viewCount)) : null,
      duration,
      avgDuration: withDur.length ? Math.round(duration / withDur.length) : null,
      likes: list.reduce((n, v) => n + (v.likeCount || 0), 0),
      share: totalViews > 0 ? views / totalViews : 0,
      last: list.length ? list.map(uploaded).sort().slice(-1)[0] : null
    }
  })
}

const COLS: Array<{ key: Key; label: string; num?: boolean; title?: string }> = [
  { key: 'name', label: '담당자' },
  { key: 'count', label: '영상', num: true, title: '올린 영상 수 (롱폼 / 숏폼)' },
  { key: 'views', label: '총 조회수', num: true },
  { key: 'share', label: '조회수 비중', title: '이 기간 전체 조회수 중 차지하는 비율' },
  { key: 'avgViews', label: '평균 조회수', num: true, title: '영상 1개당 평균 조회수' },
  { key: 'maxViews', label: '최고 조회수', num: true, title: '가장 많이 본 영상의 조회수' },
  { key: 'duration', label: '총 재생시간', num: true, title: '올린 영상 길이의 합' },
  { key: 'avgDuration', label: '평균 길이', num: true, title: '영상 1개당 평균 길이' },
  { key: 'likes', label: '좋아요', num: true },
  { key: 'last', label: '최근 업로드', title: '이 기간에 가장 최근 올린 날' }
]

function PersonStatsTable({ people, videos, onPick }: { people: Person[]; videos: Video[]; onPick: (userId: string) => void }) {
  const ui = useSkinUi()
  const v5 = ui.key === 'v5'
  const [sort, setSort] = useState<Sort>(null)
  const rows = useMemo(() => build(people, videos), [people, videos])
  const sorted = useMemo(() => {
    if (!sort) return rows
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = a[sort.key] ?? -1
      const y = b[sort.key] ?? -1
      const d = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y), 'ko') : x - y
      return d * sign
    })
  }, [rows, sort])
  const toggle = (key: Key) => setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))

  const total = useMemo(() => {
    const count = rows.reduce((n, r) => n + r.count, 0)
    const views = rows.reduce((n, r) => n + r.views, 0)
    const duration = rows.reduce((n, r) => n + r.duration, 0)
    const withDur = videos.filter((v) => v.durationSeconds != null).length
    return {
      count,
      long: rows.reduce((n, r) => n + r.long, 0),
      short: rows.reduce((n, r) => n + r.short, 0),
      views,
      avgViews: count ? Math.round(views / count) : null,
      maxViews: videos.length ? Math.max(...videos.map((v) => v.viewCount)) : null,
      duration,
      avgDuration: withDur ? Math.round(duration / withDur) : null,
      likes: rows.reduce((n, r) => n + r.likes, 0),
      active: rows.filter((r) => r.count > 0).length
    }
  }, [rows, videos])

  return (
    <div className={ui.tableWrap}>
      <table className={v5 ? 'g-table g-ds-person' : cx(ui.table, 'xs-ds-person')}>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={c.num ? 'num' : undefined} title={c.title} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className={`vt-sort${sort?.key === c.key ? ' on' : ''}`} onClick={() => toggle(c.key)}>
                  {c.label}
                  <span className="vt-sort-ico" aria-hidden="true">
                    {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </button>
              </th>
            ))}
            <th aria-label="영상 보기" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.userId} className={r.count === 0 ? 'none' : undefined}>
              <td className="nowrap">
                <span className={v5 ? 'g-who' : undefined}>{r.name}</span>
              </td>
              <td className="num nowrap">
                <b>{fmtNumber(r.count)}</b>
                {r.count > 0 && (
                  <small className="ds-sub" title="롱폼 / 숏폼">
                    {r.long}/{r.short}
                  </small>
                )}
              </td>
              <td className="num">
                <b>{fmtNumber(r.views)}</b>
              </td>
              <td className="ds-share" title={`${(r.share * 100).toFixed(1)}%`}>
                <span className="ds-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(r.share * 100)}%` }} />
                </span>
                <span className="ds-pct">{r.count ? `${Math.round(r.share * 100)}%` : '-'}</span>
              </td>
              <td className="num">{r.avgViews == null ? '-' : fmtNumber(r.avgViews)}</td>
              <td className="num">{r.maxViews == null ? '-' : fmtNumber(r.maxViews)}</td>
              <td className="num nowrap">{r.count ? fmtTotalDuration(r.duration) : '-'}</td>
              <td className="num">{r.avgDuration == null ? '-' : fmtDuration(r.avgDuration)}</td>
              <td className="num">{r.count ? fmtNumber(r.likes) : '-'}</td>
              <td className="nowrap">{shortDay(r.last)}</td>
              <td className="right">
                <button type="button" className="ds-link" onClick={() => onPick(r.userId)} title={`${r.name}의 영상만 보기`}>
                  보기 →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">
              합계 · {total.active}/{rows.length}명
            </th>
            <td className="num nowrap">
              <b>{fmtNumber(total.count)}</b>
              <small className="ds-sub">
                {total.long}/{total.short}
              </small>
            </td>
            <td className="num">
              <b>{fmtNumber(total.views)}</b>
            </td>
            <td className="ds-share">
              <span className="ds-pct">100%</span>
            </td>
            <td className="num">{total.avgViews == null ? '-' : fmtNumber(total.avgViews)}</td>
            <td className="num">{total.maxViews == null ? '-' : fmtNumber(total.maxViews)}</td>
            <td className="num nowrap">{fmtTotalDuration(total.duration)}</td>
            <td className="num">{total.avgDuration == null ? '-' : fmtDuration(total.avgDuration)}</td>
            <td className="num">{fmtNumber(total.likes)}</td>
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
