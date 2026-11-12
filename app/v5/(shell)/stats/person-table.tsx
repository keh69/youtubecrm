'use client'

import { useMemo, useState } from 'react'
import { fmtDuration, fmtNumber, fmtTotalDuration } from '@/lib/crm/client/format'
import type { Video } from '@/lib/crm/client/types'

// 영상통계 > 담당자별 (v5): 사람마다 영상 수·조회수·재생시간과 평균·최고·비중을 한눈에 보는 수치표.
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

export function PersonStatsTable({ people, videos, onPick }: { people: Person[]; videos: Video[]; onPick: (userId: string) => void }) {
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
    <div className="g-table-wrap">
      <table className="g-table g-ds-person">
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
                <span className="g-who">{r.name}</span>
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
            <th scope="row">합계 · {total.active}/{rows.length}명</th>
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
