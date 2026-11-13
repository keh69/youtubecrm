'use client'

import { useEffect, useRef, useState } from 'react'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { deleteVideo, updateVideo } from '@/lib/crm/client/hooks'
import type { Video } from '@/lib/crm/client/types'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'
import { cx, useSkinUi } from '@/lib/crm/client/skin-ui'
import { channelGroups } from '@/lib/crm/client/channels'

// 영상 표(영상통계·영상등록이 함께 쓴다).
const PAGE_SIZES = [10, 20, 30, 50, 100]

// 머리칸을 누르면 정렬: 오름차순 → 내림차순 → 기본(처음 순서) 순서로 바뀐다. 썸네일 칸은 정렬 없음.
type SortKey = 'date' | 'time' | 'channel' | 'duration' | 'format' | 'stock' | 'owner' | 'views'
type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null
const uploadedIso = (v: Video) => v.publishedAt || v.createdAt
const sortValue = (v: Video, key: SortKey): number | string => {
  if (key === 'date') return new Date(uploadedIso(v)).getTime() || 0
  if (key === 'time') return fmtHm24(uploadedIso(v)) // 하루 안의 시각(HH:mm)만 비교
  if (key === 'channel') return v.channelName || ''
  if (key === 'duration') return v.durationSeconds ?? -1
  if (key === 'format') return videoFormatLabel(v)
  if (key === 'stock') return v.stockName || ''
  if (key === 'owner') return v.ownerName || ''
  return v.viewCount
}
function sortVideos(list: Video[], sort: Sort) {
  if (!sort) return list
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const x = sortValue(a, sort.key)
    const y = sortValue(b, sort.key)
    const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko')
    return d * sign
  })
}

// 올린 시간: 한국 시간 24시간 표기(예: 13:05, 00:30)
function fmtHm24(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}

// 열: 올린 날짜 · (v5: 올린 시간) · 영상 · 재생시간 · 폼종류 · 종목 · 담당자 · 조회수 · [수정][삭제]
// 위에 열별 필터(여러 개 동시에). canEdit 이 참이면 줄 오른쪽에 수정·삭제 버튼이 나오고,
// 수정을 누르면 그 줄에서 종목명과 폼종류(롱폼/숏폼)를 바로 고친다.
// cls: 스킨 모양에 맞춘 class 이름(v5 는 g-*). 빠진 것은 기본(xs-*)을 쓴다.

export type VideoTableCls = Partial<{
  wrap: string
  table: string
  vcell: string
  thumb: string
  vtitle: string
  format: string
  formatLong: string
  formatShort: string
  who: string
  avatar: string
  chip: string
  btn: string
  btnPrimary: string
  btnDanger: string
  input: string
  empty: string
  msg: string
}>

const BASE: Required<VideoTableCls> = {
  wrap: 'xs-table-wrap',
  table: 'xs-table',
  vcell: 'xs-vcell',
  thumb: 'xs-thumb',
  vtitle: 'xs-vtitle',
  format: 'xs-chip',
  formatLong: '',
  formatShort: '',
  who: '',
  avatar: '',
  chip: 'xs-chip',
  btn: 'xs-btn',
  btnPrimary: 'xs-btn primary',
  btnDanger: 'xs-btn xs-danger',
  input: 'xs-input sm',
  empty: 'xs-empty',
  msg: 'xs-muted'
}

export function VideoTable({
  videos,
  canEdit,
  onChanged,
  cls = {},
  emptyText = '영상이 없습니다.',
  focus = null,
  dayFilter = null
}: {
  dayFilter?: { ymd: string; n: number; channel?: string | null } | null // 이 날(+ 이 채널) 올린 영상만 보이게 필터를 맞추고 표로 스크롤(n 이 바뀔 때마다)
  focus?: { id: string; n: number } | null // 이 영상이 있는 쪽으로 넘기고, 그 줄로 스크롤해 잠깐 강조한다(n 이 바뀔 때마다)
  videos: Video[]
  canEdit: boolean
  onChanged: () => void | Promise<void> // 고치거나 지운 뒤 목록 새로 불러오기
  cls?: VideoTableCls
  emptyText?: string
}) {
  const ui = useSkinUi() // 스킨 모양(따로 넘긴 cls 가 있으면 그것이 먼저)
  const c = {
    ...BASE,
    wrap: ui.tableWrap,
    table: ui.table,
    chip: ui.chip,
    btn: ui.btn,
    btnPrimary: ui.btnPrimary,
    btnDanger: ui.btnDanger,
    input: cx(ui.input, 'xs-input sm'),
    msg: ui.msgOk,
    ...cls
  }
  // 2026-11-12 '0': 모든 스킨 — 영상 열은 썸네일만(제목 빼기), 올린 날짜 오른쪽에 '올린 시간'(24시간) 열
  const hideTitle = true
  const showTime = true
  const showChannel = ui.key === 'v5' // v5전용: 0 때 해제 — 썸네일 오른쪽 '채널'(어느 유튜브 채널에 올렸나) 열
  // 채널마다 색을 정해 한눈에 구분(채널 이름 가나다순으로 색 차례)
  const channelTone = new Map(channelGroups(videos).map((g) => [g.name, g.tone]))
  const vf = useVideoFilters(videos)
  // 머리칸 눌러 정렬(모든 스킨)
  const sortable = true
  const [sort, setSort] = useState<Sort>(null)
  const list = sortable ? sortVideos(vf.filtered, sort) : vf.filtered
  const toggleSort = (key: SortKey) => setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  // 정렬 가능한 머리칸: 글자 + ▲(오름)/▼(내림)/⇅(기본)
  const sortTh = (key: SortKey, label: string, className?: string) =>
    sortable ? (
      <th className={className} aria-sort={sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className={cx('vt-sort', sort?.key === key && 'on')} onClick={() => toggleSort(key)} title="누르면 오름차순 → 내림차순 → 기본 순서">
          {label}
          <span className="vt-sort-ico" aria-hidden="true">
            {sort?.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </button>
      </th>
    ) : (
      <th className={className}>{label}</th>
    )
  // 몇 개씩 보기(기본 10개) + 아래 페이지 번호(모든 스킨)
  const paged = true
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [vf.f, pageSize, sort]) // 필터·보기 개수·정렬을 바꾸면 1쪽으로
  const pages = paged ? Math.max(1, Math.ceil(list.length / pageSize)) : 1
  const cur = Math.min(page, pages)
  const rows = paged ? list.slice((cur - 1) * pageSize, cur * pageSize) : list
  const winStart = Math.max(1, Math.min(cur - 4, pages - 9)) // 페이지 번호는 최대 10개까지 보인다
  const pageNums = Array.from({ length: Math.min(10, pages) }, (_, i) => winStart + i)
  // 다른 곳(예약 표 [완료])에서 이 영상을 보여 달라고 하면: 필터에 가려 있으면 필터를 풀고, 그 영상이 있는 쪽으로 넘긴 뒤 스크롤·강조
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)
  const [hl, setHl] = useState<{ id: string; n: number } | null>(null)
  useEffect(() => {
    if (focus) setPendingFocus(focus.id)
  }, [focus])
  useEffect(() => {
    if (!pendingFocus) return
    const idx = list.findIndex((v) => v.id === pendingFocus)
    if (idx < 0) {
      if (vf.activeCount > 0) vf.clear() // 다음 그림에서 다시 찾는다
      else setPendingFocus(null)
      return
    }
    setPage(Math.floor(idx / pageSize) + 1)
    setHl({ id: pendingFocus, n: Date.now() })
    setPendingFocus(null)
  }, [pendingFocus, list, pageSize, vf])
  useEffect(() => {
    if (!hl) return
    const row = document.querySelector(`[data-vid="${hl.id}"]`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = window.setTimeout(() => setHl(null), 3000)
    return () => window.clearTimeout(t)
  }, [hl])
  const tableTop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!dayFilter) return
    vf.setF({ ...vf.f, dateFrom: dayFilter.ymd, dateTo: dayFilter.ymd, channels: dayFilter.channel ? [dayFilter.channel] : [] })
    tableTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayFilter])
  const [editing, setEditing] = useState<{ id: string; stockName: string; contentType: 'longform' | 'shortform' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const save = async () => {
    if (!editing) return
    if (!editing.stockName.trim()) return setMsg('종목명을 입력해 주세요.')
    setBusy(editing.id)
    const res = await updateVideo(editing.id, { stockName: editing.stockName.trim(), contentType: editing.contentType })
    setBusy(null)
    if (!res.ok) return setMsg(res.error || '수정하지 못했습니다.')
    setEditing(null)
    setMsg('수정했습니다.')
    await onChanged()
  }
  const remove = async (v: Video) => {
    if (!window.confirm(`"${v.title}" 영상을 CRM에서 삭제할까요? (유튜브 영상은 그대로입니다)`)) return
    setBusy(v.id)
    const res = await deleteVideo(v.id)
    setBusy(null)
    if (!res.ok) return setMsg(res.error || '삭제하지 못했습니다.')
    setMsg('삭제했습니다.')
    await onChanged()
  }

  if (videos.length === 0) return <p className={c.empty}>{emptyText}</p>

  return (
    <>
      <div ref={tableTop} aria-hidden="true" />
      <VideoFilterBar
        ctl={vf}
        total={videos.length}
        hideTitle={hideTitle}
        oneLine={hideTitle}
        extra={
          paged && (
            <label className="vf-size">
              보기
              <select className="vf-input" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="한 쪽에 보일 영상 수">
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}개씩
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />
      {msg && <p className={c.msg} role="status">{msg}</p>}
      <div className={c.wrap}>
        <table className={hideTitle ? cx(c.table, 'no-title') : c.table}>
          <thead>
            <tr>
              {sortTh('date', '올린 날짜')}
              {showTime && sortTh('time', '올린 시간')}
              <th className={hideTitle ? 'thumb-col' : undefined}>{hideTitle ? '썸네일' : '영상'}</th>
              {showChannel && sortTh('channel', '채널')}
              {sortTh('duration', '재생시간', 'num')}
              {sortTh('format', '폼종류')}
              {sortTh('stock', '종목')}
              {sortTh('owner', '담당자')}
              {sortTh('views', '조회수', 'num')}
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const fmt = videoFormatLabel(v)
              const ed = editing?.id === v.id ? editing : null
              return (
                <tr key={v.id} data-vid={v.id} className={hl?.id === v.id ? 'vt-hl' : undefined}>
                  <td className="num nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                  {showTime && <td className="num nowrap">{fmtHm24(v.publishedAt || v.createdAt)}</td>}
                  <td className={hideTitle ? 'thumb-col' : undefined}>
                    <div className={c.vcell}>
                      <a href={v.url} target="_blank" rel="noreferrer" className={c.thumb} aria-label={`${v.title} 유튜브에서 보기`} title={v.title}>
                        <img src={v.thumbnailUrl} alt="" loading="lazy" />
                      </a>
                      {!hideTitle && (
                        <a href={v.url} target="_blank" rel="noreferrer" className={c.vtitle}>
                          {v.title}
                        </a>
                      )}
                    </div>
                  </td>
                  {showChannel && (
                    <td className="nowrap">
                      {v.channelName ? (
                        <span className={`vt-ch t${channelTone.get(v.channelName) ?? 0}`} title={v.channelName}>
                          {v.channelName}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}
                  <td className="num nowrap">{fmtDuration(v.durationSeconds)}</td>
                  <td className="nowrap">
                    {ed ? (
                      <select className={c.input} value={ed.contentType} onChange={(e) => setEditing({ ...ed, contentType: e.target.value as 'longform' | 'shortform' })} aria-label="폼종류">
                        <option value="longform">롱폼</option>
                        <option value="shortform">숏폼</option>
                      </select>
                    ) : (
                      <span className={`${c.format} ${fmt === '롱폼' ? c.formatLong : c.formatShort}`.trim()}>{fmt}</span>
                    )}
                  </td>
                  <td className="nowrap">
                    {ed ? (
                      <input
                        className={c.input}
                        value={ed.stockName}
                        maxLength={60}
                        autoFocus
                        aria-label="종목명"
                        onChange={(e) => setEditing({ ...ed, stockName: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void save()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                      />
                    ) : (
                      <span className={c.chip}>{v.stockName}</span>
                    )}
                  </td>
                  <td className="nowrap">
                    <span className={c.who}>
                      {c.avatar && <span className={c.avatar}>{(v.ownerName || '-').slice(0, 1)}</span>}
                      {v.ownerName || '-'}
                    </span>
                  </td>
                  <td className="num">{fmtNumber(v.viewCount)}</td>
                  {canEdit && (
                    <td className="right nowrap">
                      {ed ? (
                        <>
                          <button className={c.btnPrimary} disabled={busy === v.id} onClick={save}>
                            {busy === v.id ? '저장 중…' : '저장'}
                          </button>{' '}
                          <button className={c.btn} onClick={() => setEditing(null)}>
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={c.btn}
                            disabled={busy !== null}
                            onClick={() => {
                              setMsg('')
                              setEditing({ id: v.id, stockName: v.stockName, contentType: fmt === '숏폼' ? 'shortform' : 'longform' })
                            }}
                          >
                            수정
                          </button>{' '}
                          <button className={c.btnDanger} disabled={busy !== null} onClick={() => remove(v)}>
                            {busy === v.id ? '삭제 중…' : '삭제'}
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className={c.empty}>필터에 맞는 영상이 없습니다.</p>}
      {paged && pages > 1 && (
        <nav className="g-pager vt-pager" aria-label="영상 페이지">
          <button type="button" className={c.btn} disabled={cur === 1} onClick={() => setPage(cur - 1)}>
            ◀ 이전
          </button>
          {pageNums.map((n) => (
            <button key={n} type="button" className={n === cur ? c.btnPrimary : c.btn} aria-current={n === cur ? 'page' : undefined} onClick={() => setPage(n)}>
              {n}
            </button>
          ))}
          <button type="button" className={c.btn} disabled={cur === pages} onClick={() => setPage(cur + 1)}>
            다음 ▶
          </button>
        </nav>
      )}
    </>
  )
}
