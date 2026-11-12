'use client'

import { useMemo, useState } from 'react'
import { useReservations, useSession } from '@/lib/crm/client/hooks'
import { MultiPick } from '@/components/video-filters'
import type { Reservation, Video } from '@/lib/crm/client/types'
import { fmtDuration } from '@/lib/crm/client/format'
import { cx, useSkinUi } from '@/lib/crm/client/skin-ui'
import { VideoTypePicker } from '@/components/video-type-picker'

type Msg = { tone: 'ok' | 'error'; text: string } | null

// 영상등록 > 예약등록 (모든 스킨 공통 부품, 스킨 모양은 useSkinUi). v5 는 app/v5/(shell)/videos/reservation-section.tsx 를 쓴다.
// 유튜브 예약 업로드 링크를 미리 넣어 두면, 영상이 공개된 뒤 자동으로 '영상리스트'에 들어간다.

// KST 날짜·시각 보기: 11.13 (금) 18:00
function fmtKst(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  )
  return `${p.month}.${p.day} (${p.weekday}) ${p.hour}:${p.minute}`
}

// 공개 시각은 받지 않는다(유튜브에서 정한 시각을 API 로 읽을 수 없고, 등록은 실제 공개를 보고 한다)
// 예약 표 필터: 예약한 날(범위)·등록자·폼종류·종목·상태. 여러 개를 걸면 모두 맞는 것만.
type RF = { from: string; to: string; owners: string[]; formats: string[]; stocks: string[]; states: string[] }
const RF_EMPTY: RF = { from: '', to: '', owners: [], formats: [], stocks: [], states: [] }
const PAGE_SIZE = 5 // 예약 표는 5개씩, 넘으면 아래 페이지 번호
const FORMAT_LABEL = { longform: '롱폼', shortform: '숏폼' } as const
const stateLabel = (x: Reservation) => (x.status === 'waiting' ? '공개 대기' : '등록됨')
// 예약한 날(KST) YYYY-MM-DD
const kstYmd = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))

type Form = { stockName: string; contentType: 'longform' | 'shortform' | ''; url: string }
const EMPTY: Form = { stockName: '', contentType: '', url: '' }

// listed: 아래 영상리스트에 있는 영상들(재생시간·'영상리스트 반영' 판단용). onShow: [완료]를 누르면 영상리스트에서 그 영상으로 이동
export function ReservationSection({ onMoved, listed, onShow }: { onMoved: () => void | Promise<void>; listed: Video[]; onShow: (videoId: string) => void }) {
  const r = useReservations()
  const ui = useSkinUi()
  const { me } = useSession()
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const waiting = r.items.filter((x) => x.status === 'waiting')
  const listedByYt = useMemo(() => new Map(listed.map((v) => [v.youtubeVideoId, v])), [listed])
  const showOwner = Boolean(me.isSuperAdmin) // 총관리자는 모든 직원의 예약이 보이므로 등록자 열을 단다
  const [rf, setRf] = useState<RF>(RF_EMPTY)
  const [page, setPage] = useState(1)
  const setFilter = (patch: Partial<RF>) => {
    setRf((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  const opts = useMemo(
    () => ({
      owners: uniq(r.items.map((x) => x.ownerName || '')),
      formats: uniq(r.items.map((x) => FORMAT_LABEL[x.contentType])),
      stocks: uniq(r.items.map((x) => x.stockName)),
      states: ['공개 대기', '등록됨']
    }),
    [r.items]
  )
  const filtered = r.items.filter((x) => {
    const d = kstYmd(x.createdAt)
    if (rf.from && d < rf.from) return false
    if (rf.to && d > rf.to) return false
    if (rf.owners.length && !rf.owners.includes(x.ownerName || '')) return false
    if (rf.formats.length && !rf.formats.includes(FORMAT_LABEL[x.contentType])) return false
    if (rf.stocks.length && !rf.stocks.includes(x.stockName)) return false
    if (rf.states.length && !rf.states.includes(stateLabel(x))) return false
    return true
  })
  const activeCount = [rf.from || rf.to, rf.owners.length, rf.formats.length, rf.stocks.length, rf.states.length].filter(Boolean).length
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const pageItems = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.stockName.trim()) return setMsg({ tone: 'error', text: '종목명을 입력해 주세요.' })
    if (!form.contentType) return setMsg({ tone: 'error', text: '롱폼 또는 숏폼을 골라 주세요.' })
    if (!form.url.trim()) return setMsg({ tone: 'error', text: '유튜브 예약 링크를 입력해 주세요.' })
    setBusy(true)
    const res = await r.reserve({
      youtubeUrl: form.url.trim(),
      stockName: form.stockName.trim(),
      contentType: form.contentType
    })
    setBusy(false)
    if (!res.ok) return setMsg({ tone: 'error', text: res.error || '예약등록하지 못했습니다.' })
    setForm({ ...EMPTY, contentType: form.contentType })
    if (res.data.registered) {
      setMsg({ tone: 'ok', text: '이미 공개된 영상이라 바로 영상등록했습니다.' })
      await onMoved()
    } else setMsg({ tone: 'ok', text: '예약등록했습니다. 유튜브에 공개되면 자동으로 영상등록됩니다.' })
  }

  // 삭제: CRM 예약 목록에서만 지운다(유튜브 예약·이미 등록된 영상은 그대로)
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" 예약을 삭제할까요? (유튜브 예약과 이미 등록된 영상은 그대로입니다)`)) return
    const res = await r.cancel(id)
    setMsg(res.ok ? { tone: 'ok', text: '예약을 삭제했습니다.' } : { tone: 'error', text: res.error || '삭제하지 못했습니다.' })
  }

  return (
    <section className={cx(ui.section, 'xs-panel xs-resv')}>
      <h2 className={cx(ui.h2, 'xs-h')}>
        예약등록 (공개 대기 {waiting.length}){showOwner && <small className={ui.muted}> · 전체 직원</small>}
      </h2>
      <p className={ui.muted}>유튜브에서 예약 업로드한 뒤 나오는 링크를 넣어 두세요. 영상이 공개되면 자동으로 아래 &apos;영상리스트&apos;에 들어갑니다(영상등록·영상통계 화면을 열 때 확인합니다).</p>
      <form className="xs-bar xs-resv-form" onSubmit={submit}>
        <div className={cx(ui.field, 'xs-field')}>
          <span>등록자</span>
          <div className="xs-readonly" title="로그인한 사람 이름이 자동으로 붙습니다">
            {me.name} <small>(자동)</small>
          </div>
        </div>
        <label className={cx(ui.field, 'xs-field')}>
          <span>종목명</span>
          <input className={cx(ui.input, 'xs-input')} value={form.stockName} onChange={(e) => setForm({ ...form, stockName: e.target.value })} placeholder="예) 삼성전자" maxLength={60} />
        </label>
        <VideoTypePicker value={form.contentType} onChange={(k) => setForm({ ...form, contentType: k })} />
        <label className={cx(ui.field, 'xs-field xs-grow')}>
          <span>유튜브 예약 링크</span>
          <input className={cx(ui.input, 'xs-input')} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtu.be/..." inputMode="url" />
        </label>
        <button className={cx(ui.btnPrimary, 'xs-resv-btn')} disabled={busy}>
          {busy ? '등록 중…' : '예약등록'}
        </button>
      </form>
      {(msg || r.error) && (
        <p className={(msg?.tone ?? 'error') === 'ok' ? ui.msgOk : ui.msgErr} role="status">
          {msg?.text ?? r.error}
        </p>
      )}

      {r.loading ? (
        <p className={ui.muted}>불러오는 중…</p>
      ) : r.items.length === 0 ? (
        <p className="xs-empty">예약등록한 영상이 없습니다.</p>
      ) : (
        <>
        <div className="vf-status vf-status-top">
          <span>
            {activeCount > 0 ? (
              <>
                필터 {activeCount}개 · <b>{filtered.length}</b> / {r.items.length}개
              </>
            ) : (
              <>전체 {r.items.length}개</>
            )}
          </span>
          {activeCount > 0 && (
            <button type="button" className="vf-mini" onClick={() => setFilter(RF_EMPTY)}>
              필터 모두 지우기
            </button>
          )}
        </div>
        <div className="vf-bar vf-one" role="group" aria-label="예약 필터">
          <div className="vf-field">
            <span className="vf-label">예약한 날</span>
            <span className="vf-range">
              <input className="vf-input" type="date" value={rf.from} onChange={(e) => setFilter({ from: e.target.value })} aria-label="예약한 날 시작" />~
              <input className="vf-input" type="date" value={rf.to} onChange={(e) => setFilter({ to: e.target.value })} aria-label="예약한 날 끝" />
            </span>
          </div>
          {showOwner && <MultiPick label="등록자" all={opts.owners} value={rf.owners} onChange={(owners) => setFilter({ owners })} />}
          <MultiPick label="폼종류" all={opts.formats} value={rf.formats} onChange={(formats) => setFilter({ formats })} />
          <MultiPick label="종목" all={opts.stocks} value={rf.stocks} onChange={(stocks) => setFilter({ stocks })} />
          <MultiPick label="상태" all={opts.states} value={rf.states} onChange={(states) => setFilter({ states })} />
        </div>
        <div className={ui.tableWrap}>
          <table className={cx(ui.table, 'xs-resv-table')}>
            <thead>
              <tr>
                <th>예약한 날</th>
                {showOwner && <th>등록자</th>}
                <th>예약 링크</th>
                <th className="num">재생시간</th>
                <th>폼종류</th>
                <th>종목</th>
                <th>상태</th>
                <th>영상리스트 반영</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={showOwner ? 9 : 8} className="xs-empty">
                    조건에 맞는 예약이 없습니다.
                  </td>
                </tr>
              )}
              {pageItems.map((x) => {
                const inList = listedByYt.get(x.youtubeVideoId)
                return (
                <tr key={x.id}>
                  <td className="nowrap">{fmtKst(x.createdAt)}</td>
                  {showOwner && <td className="nowrap">{x.ownerName || '-'}</td>}
                  <td className="nowrap">
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.url.replace('https://', '')}
                    </a>
                  </td>
                  <td className="num nowrap" title={inList ? undefined : '공개되어 영상리스트에 들어가면 보입니다'}>
                    {inList ? fmtDuration(inList.durationSeconds) : '-'}
                  </td>
                  <td className="nowrap">
                    <span className="xs-chip">{x.contentType === 'longform' ? '롱폼' : '숏폼'}</span>
                  </td>
                  <td className="nowrap">
                    <span className={ui.chip}>{x.stockName}</span>
                  </td>
                  <td className="nowrap">
                    {x.status === 'waiting' ? (
                      <span className={ui.chip} title={x.lastCheckedAt ? `마지막 확인 ${fmtKst(x.lastCheckedAt)}` : '아직 확인 전'}>
                        ⏳ 공개 대기
                      </span>
                    ) : (
                      <span className={ui.chip}>✅ 등록됨 {fmtKst(x.registeredAt)}</span>
                    )}
                  </td>
                  <td className="nowrap">
                    {inList ? (
                      <button type="button" className="xs-reflect done" onClick={() => onShow(inList.id)} title="누르면 아래 영상리스트에서 이 영상으로 이동합니다">
                        완료
                      </button>
                    ) : (
                      <span className="xs-reflect">미완료</span>
                    )}
                  </td>
                  <td className="right nowrap">
                    <button type="button" className={ui.btnDanger} onClick={() => remove(x.id, x.stockName)}>
                      삭제
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav className="vt-pager" aria-label="예약 페이지">
            <button type="button" className={ui.btn} disabled={cur === 1} onClick={() => setPage(cur - 1)}>
              ◀ 이전
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={n === cur ? ui.btnPrimary : ui.btn} aria-current={n === cur ? 'page' : undefined} onClick={() => setPage(n)}>
                {n}
              </button>
            ))}
            <button type="button" className={ui.btn} disabled={cur === pages} onClick={() => setPage(cur + 1)}>
              다음 ▶
            </button>
          </nav>
        )}
        </>
      )}
    </section>
  )
}
