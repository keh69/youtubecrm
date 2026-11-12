'use client'

import { useMemo, useState } from 'react'
import { fmtDate, videoFormatLabel } from '@/lib/crm/client/format'

// 영상통계 > 영상 표 필터(모든 스킨 공통).
// 열마다 조건을 걸 수 있고, 여러 열 조건을 한꺼번에 걸면 모두 맞는 영상만 남는다(중복 필터).
// 담당자·형식·종목은 여러 값을 골라 하나라도 맞으면 보인다. 제목은 글자 포함, 조회수·재생시간·올린 날짜는 범위.

type V = {
  id: string
  title: string
  ownerName?: string | null
  stockName: string
  viewCount: number
  durationSeconds: number | null
  publishedAt: string | null
  createdAt: string
  contentType?: string
}

type Filters = {
  title: string
  owners: string[]
  formats: string[]
  stocks: string[]
  viewsMin: string
  viewsMax: string
  durMin: string // 분
  durMax: string
  dateFrom: string // YYYY-MM-DD
  dateTo: string
}
const EMPTY: Filters = { title: '', owners: [], formats: [], stocks: [], viewsMin: '', viewsMax: '', durMin: '', durMax: '', dateFrom: '', dateTo: '' }
const ymd = (v: V) => fmtDate(v.publishedAt || v.createdAt).replace(/\./g, '-')

export function useVideoFilters<T extends V>(videos: T[]) {
  const [f, setF] = useState<Filters>(EMPTY)
  const options = useMemo(
    () => ({
      owners: [...new Set(videos.map((v) => v.ownerName || '-'))].sort((a, b) => a.localeCompare(b, 'ko')),
      stocks: [...new Set(videos.map((v) => v.stockName))].sort((a, b) => a.localeCompare(b, 'ko')),
      formats: ['롱폼', '숏폼']
    }),
    [videos]
  )
  const filtered = useMemo(() => {
    const num = (s: string) => (s.trim() === '' ? null : Number(s))
    const vMin = num(f.viewsMin)
    const vMax = num(f.viewsMax)
    const dMin = num(f.durMin)
    const dMax = num(f.durMax)
    const q = f.title.trim().toLowerCase()
    return videos.filter((v) => {
      if (q && !v.title.toLowerCase().includes(q)) return false
      if (f.owners.length && !f.owners.includes(v.ownerName || '-')) return false
      if (f.formats.length && !f.formats.includes(videoFormatLabel(v))) return false
      if (f.stocks.length && !f.stocks.includes(v.stockName)) return false
      if (vMin !== null && v.viewCount < vMin) return false
      if (vMax !== null && v.viewCount > vMax) return false
      const mins = (v.durationSeconds || 0) / 60
      if (dMin !== null && mins < dMin) return false
      if (dMax !== null && mins > dMax) return false
      const d = ymd(v)
      if (f.dateFrom && d < f.dateFrom) return false
      if (f.dateTo && d > f.dateTo) return false
      return true
    })
  }, [videos, f])
  const activeCount =
    (f.title.trim() ? 1 : 0) +
    (f.owners.length ? 1 : 0) +
    (f.formats.length ? 1 : 0) +
    (f.stocks.length ? 1 : 0) +
    (f.viewsMin || f.viewsMax ? 1 : 0) +
    (f.durMin || f.durMax ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0)
  return { f, setF, options, filtered, activeCount, clear: () => setF(EMPTY) }
}

function MultiPick({ label, all, value, onChange }: { label: string; all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('')
  const shown = all.filter((x) => x.toLowerCase().includes(q.trim().toLowerCase()))
  const summary = value.length === 0 ? '전체' : value.length <= 2 ? value.join(', ') : `${value.slice(0, 2).join(', ')} 외 ${value.length - 2}`
  return (
    <details className="vf-multi">
      <summary>
        <span className="vf-label">{label}</span>
        <span className={value.length ? 'vf-on' : ''}>{summary}</span>
      </summary>
      <div className="vf-pop">
        {all.length > 8 && <input className="vf-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기" aria-label={`${label} 찾기`} />}
        <div className="vf-list">
          {shown.map((x) => (
            <label key={x} className="vf-opt">
              <input type="checkbox" className="rsd-chk" checked={value.includes(x)} onChange={() => onChange(value.includes(x) ? value.filter((y) => y !== x) : [...value, x])} />
              {x}
            </label>
          ))}
          {shown.length === 0 && <span className="vf-none">없음</span>}
        </div>
        {value.length > 0 && (
          <button type="button" className="vf-mini" onClick={() => onChange([])}>
            선택 지우기
          </button>
        )}
      </div>
    </details>
  )
}

export function VideoFilterBar({ ctl, total }: { ctl: ReturnType<typeof useVideoFilters>; total: number }) {
  const { f, setF, options } = ctl
  const set = (patch: Partial<Filters>) => setF({ ...f, ...patch })
  return (
    <div className="vf-bar" role="group" aria-label="영상 필터">
      {/* 표 열 순서대로: 올린 날짜 · 영상 · 재생시간 · 폼종류 · 종목 · 담당자 · 조회수 */}
      <div className="vf-field">
        <span className="vf-label">올린 날짜</span>
        <span className="vf-range">
          <input className="vf-input" type="date" value={f.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} aria-label="올린 날짜 시작" />~
          <input className="vf-input" type="date" value={f.dateTo} onChange={(e) => set({ dateTo: e.target.value })} aria-label="올린 날짜 끝" />
        </span>
      </div>
      <label className="vf-field vf-grow">
        <span className="vf-label">영상(제목)</span>
        <input className="vf-input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="제목에 들어간 글자" />
      </label>
      <div className="vf-field">
        <span className="vf-label">재생시간(분)</span>
        <span className="vf-range">
          <input className="vf-input" inputMode="decimal" value={f.durMin} onChange={(e) => set({ durMin: e.target.value.replace(/[^\d.]/g, '') })} placeholder="최소" aria-label="재생시간 최소(분)" />~
          <input className="vf-input" inputMode="decimal" value={f.durMax} onChange={(e) => set({ durMax: e.target.value.replace(/[^\d.]/g, '') })} placeholder="최대" aria-label="재생시간 최대(분)" />
        </span>
      </div>
      <MultiPick label="폼종류" all={options.formats} value={f.formats} onChange={(formats) => set({ formats })} />
      <MultiPick label="종목" all={options.stocks} value={f.stocks} onChange={(stocks) => set({ stocks })} />
      <MultiPick label="담당자" all={options.owners} value={f.owners} onChange={(owners) => set({ owners })} />
      <div className="vf-field">
        <span className="vf-label">조회수</span>
        <span className="vf-range">
          <input className="vf-input" inputMode="numeric" value={f.viewsMin} onChange={(e) => set({ viewsMin: e.target.value.replace(/\D/g, '') })} placeholder="최소" aria-label="조회수 최소" />~
          <input className="vf-input" inputMode="numeric" value={f.viewsMax} onChange={(e) => set({ viewsMax: e.target.value.replace(/\D/g, '') })} placeholder="최대" aria-label="조회수 최대" />
        </span>
      </div>
      <div className="vf-status">
        <span>
          {ctl.activeCount > 0 ? (
            <>
              필터 {ctl.activeCount}개 · <b>{ctl.filtered.length}</b> / {total}개
            </>
          ) : (
            <>전체 {total}개</>
          )}
        </span>
        {ctl.activeCount > 0 && (
          <button type="button" className="vf-mini" onClick={ctl.clear}>
            필터 모두 지우기
          </button>
        )}
      </div>
    </div>
  )
}
