'use client'

import { useState } from 'react'
import { useReservations } from '@/lib/crm/client/hooks'
import { Loading, Note, type Msg } from '../../_components/ui'

// 영상등록 > 예약등록 (v5)
// 유튜브 예약 업로드 링크를 미리 넣어 두면, 영상이 공개된 뒤 자동으로 '내가 등록한 영상'에 들어간다.

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

type Form = { stockName: string; contentType: 'longform' | 'shortform' | ''; url: string; when: string }
const EMPTY: Form = { stockName: '', contentType: '', url: '', when: '' }

export function ReservationSection({ onMoved }: { onMoved: () => void | Promise<void> }) {
  const r = useReservations()
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const waiting = r.items.filter((x) => x.status === 'waiting')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.stockName.trim()) return setMsg({ tone: 'error', text: '종목명을 입력해 주세요.' })
    if (!form.contentType) return setMsg({ tone: 'error', text: '롱폼 또는 숏폼을 골라 주세요.' })
    if (!form.url.trim()) return setMsg({ tone: 'error', text: '유튜브 예약 링크를 입력해 주세요.' })
    setBusy(true)
    const res = await r.reserve({
      youtubeUrl: form.url.trim(),
      stockName: form.stockName.trim(),
      contentType: form.contentType,
      scheduledAt: form.when ? new Date(form.when).toISOString() : null // 화면에서 고른 한국 시각 그대로
    })
    setBusy(false)
    if (!res.ok) return setMsg({ tone: 'error', text: res.error || '예약등록하지 못했습니다.' })
    setForm({ ...EMPTY, contentType: form.contentType })
    if (res.data.registered) {
      setMsg({ tone: 'ok', text: '이미 공개된 영상이라 바로 영상등록했습니다.' })
      await onMoved()
    } else setMsg({ tone: 'ok', text: '예약등록했습니다. 유튜브에 공개되면 자동으로 영상등록됩니다.' })
  }

  const cancel = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" 예약을 취소할까요? (유튜브 예약은 그대로입니다)`)) return
    const res = await r.cancel(id)
    setMsg(res.ok ? { tone: 'ok', text: '예약을 취소했습니다.' } : { tone: 'error', text: res.error || '취소하지 못했습니다.' })
  }

  // 지금 확인: 공개된 예약을 옮기고 아래 영상 표도 새로 불러온다
  const recheck = async () => {
    await r.reload()
    await onMoved()
  }

  return (
    <section className="g-glass g-register">
      <div className="g-card-head">
        <h2 className="g-h2">예약등록 (공개 대기 {waiting.length})</h2>
        <button type="button" className="g-btn ghost sm" onClick={recheck}>
          지금 확인
        </button>
      </div>
      <p className="g-muted g-small">유튜브에서 예약 업로드한 뒤 나오는 링크를 넣어 두세요. 영상이 공개되면 자동으로 아래 &apos;내가 등록한 영상&apos;에 들어갑니다(영상등록·영상통계 화면을 열 때 확인합니다).</p>
      <form className="g-row-form" onSubmit={submit}>
        <label className="g-field">
          <span>종목명</span>
          <input className="g-input" value={form.stockName} onChange={(e) => setForm({ ...form, stockName: e.target.value })} placeholder="예) 삼성전자" maxLength={60} />
        </label>
        <div className="g-field">
          <span>형식 *</span>
          <div className="g-seg g-type-pick" role="radiogroup" aria-label="롱폼 또는 숏폼">
            {(
              [
                ['longform', '롱폼'],
                ['shortform', '숏폼']
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={form.contentType === k} className={form.contentType === k ? 'on' : ''} onClick={() => setForm({ ...form, contentType: k })}>
                {form.contentType === k ? '☑' : '☐'} {label}
              </button>
            ))}
          </div>
        </div>
        <label className="g-field">
          <span>공개 예정 (선택)</span>
          <input className="g-input" type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
        </label>
        <label className="g-field grow">
          <span>유튜브 예약 링크</span>
          <input className="g-input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtu.be/..." inputMode="url" />
        </label>
        <button className="g-btn primary g-register-btn" disabled={busy}>
          {busy ? '등록 중…' : '예약등록'}
        </button>
      </form>
      <Note msg={msg ?? (r.error ? { tone: 'error', text: r.error } : null)} />

      {r.loading ? (
        <Loading />
      ) : r.items.length === 0 ? (
        <p className="g-empty">예약등록한 영상이 없습니다.</p>
      ) : (
        <div className="g-table-wrap">
          <table className="g-table g-resv-table">
            <thead>
              <tr>
                <th>예약한 날</th>
                <th>공개 예정</th>
                <th>예약 링크</th>
                <th>폼종류</th>
                <th>종목</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {r.items.map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{fmtKst(x.createdAt)}</td>
                  <td className="nowrap">{fmtKst(x.scheduledAt)}</td>
                  <td className="nowrap">
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.url.replace('https://', '')}
                    </a>
                  </td>
                  <td className="nowrap">
                    <span className={`g-format ${x.contentType === 'longform' ? 'long' : 'short'}`}>{x.contentType === 'longform' ? '롱폼' : '숏폼'}</span>
                  </td>
                  <td className="nowrap">
                    <span className="g-chip accent">{x.stockName}</span>
                  </td>
                  <td className="nowrap">
                    {x.status === 'waiting' ? (
                      <span className="g-chip" title={x.lastCheckedAt ? `마지막 확인 ${fmtKst(x.lastCheckedAt)}` : '아직 확인 전'}>
                        ⏳ 공개 대기
                      </span>
                    ) : (
                      <span className="g-chip accent">✅ 등록됨 {fmtKst(x.registeredAt)}</span>
                    )}
                  </td>
                  <td className="right nowrap">
                    {x.status === 'waiting' && (
                      <button type="button" className="g-btn soft-danger sm" onClick={() => cancel(x.id, x.stockName)}>
                        취소
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
