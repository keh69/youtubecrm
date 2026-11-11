'use client'

import { useState } from 'react'
import { useUnresolved, type ResolveAction, type UnresolvedItem } from '@/lib/crm/client/hooks'
import { fmtTime, fmtYmdShort } from '@/lib/crm/client/format'
import { Empty, Loading, Note, type Msg } from '../../_components/ui'

// 처리 방법: 고르면 기본 시간이 채워진다(고칠 수 있음). 결근·휴무는 시간 대신 사유.
const IN_ACTIONS: Array<{ key: ResolveAction; label: string; time: string | null }> = [
  { key: 'in', label: '출근', time: '09:00' },
  { key: 'in_late', label: '출근(지각)', time: '09:30' },
  { key: 'absent', label: '결근', time: null },
  { key: 'off', label: '휴무', time: null }
]
const OUT_ACTIONS: Array<{ key: ResolveAction; label: string; time: string | null }> = [
  { key: 'out', label: '퇴근', time: '18:00' },
  { key: 'out_overtime', label: '퇴근(야근)', time: '21:00' }
]

function ResolveRow({ item, onResolve }: { item: UnresolvedItem; onResolve: ReturnType<typeof useUnresolved>['resolve'] }) {
  const actions = item.kind === 'in' ? IN_ACTIONS : OUT_ACTIONS
  const [action, setAction] = useState<ResolveAction>(actions[0].key)
  const [time, setTime] = useState(actions[0].time || '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const current = actions.find((a) => a.key === action)!

  const pick = (key: ResolveAction) => {
    const a = actions.find((x) => x.key === key)!
    setAction(key)
    if (a.time) setTime(a.time)
    setErr('')
  }
  const submit = async () => {
    setBusy(true)
    setErr('')
    const res = await onResolve({ userId: item.userId, workDate: item.workDate, action, time: current.time ? time : null, note: current.time ? '' : note })
    setBusy(false)
    if (!res.ok) setErr(res.error || '처리하지 못했습니다.')
  }

  return (
    <tr>
      <td className="nowrap">
        <strong>{fmtYmdShort(item.workDate)}</strong>
      </td>
      <td className="nowrap">
        {item.name} <small className="g-muted">({item.loginId})</small>
      </td>
      {item.kind === 'out' && <td className="nowrap g-num">{fmtTime(item.checkInAt)}</td>}
      <td>
        <div className="g-resolve">
          <span className="g-seg sm" role="radiogroup" aria-label={`${item.name} ${fmtYmdShort(item.workDate)} 처리 방법`}>
            {actions.map((a) => (
              <button key={a.key} type="button" role="radio" aria-checked={action === a.key} className={action === a.key ? 'on' : ''} onClick={() => pick(a.key)}>
                {a.label}
              </button>
            ))}
          </span>
          {current.time ? (
            <input className="g-input sm g-resolve-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="시간" />
          ) : (
            <input className="g-input sm g-resolve-note" value={note} maxLength={300} placeholder={action === 'absent' ? '결근 사유(선택)' : '휴무 사유(선택)'} onChange={(e) => setNote(e.target.value)} aria-label="사유" />
          )}
          <button className="g-btn primary sm" disabled={busy || (Boolean(current.time) && !time)} onClick={submit}>
            {busy ? '처리 중…' : '처리'}
          </button>
        </div>
        {err && <p className="g-msg error g-resolve-err">{err}</p>}
      </td>
    </tr>
  )
}

// 설정 → 07 미처리: 출근미처리(출근을 안 누른 날)·퇴근미처리(퇴근을 안 눌러 23:59 자동 퇴근된 날)
export function UnresolvedTab() {
  const u = useUnresolved()
  const [msg] = useState<Msg>(null)
  if (u.loading && !u.data) return <Loading />
  if (u.error) return <Note msg={{ tone: 'error', text: u.error }} role="alert" />
  const d = u.data!

  return (
    <>
      <section className="g-glass">
        <h2 className="g-h2">미처리</h2>
        <p className="g-muted g-small">
          최근 2주({fmtYmdShort(d.from)} ~ {fmtYmdShort(d.to)}) 동안 평일(월~금)에 출근을 안 누른 날과, 퇴근을 안 눌러 23:59에 자동 퇴근된 날입니다. 오늘 출근은 09:00이 지나야 나타납니다. 출근·출근(지각)·퇴근·퇴근(야근)·결근·휴무 중 하나로 처리하면 목록에서 사라집니다.
        </p>
        <Note msg={msg} />
      </section>

      <section className="g-glass">
        <h2 className="g-h2">
          출근미처리 <span className="g-chip">{d.checkIn.length}건</span>
        </h2>
        {d.checkIn.length === 0 ? (
          <Empty>출근미처리가 없습니다.</Empty>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>직원</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {d.checkIn.map((it) => (
                  <ResolveRow key={`${it.userId}-${it.workDate}`} item={it} onResolve={u.resolve} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="g-glass">
        <h2 className="g-h2">
          퇴근미처리 <span className="g-chip">{d.checkOut.length}건</span>
        </h2>
        {d.checkOut.length === 0 ? (
          <Empty>퇴근미처리가 없습니다.</Empty>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>직원</th>
                  <th>출근</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {d.checkOut.map((it) => (
                  <ResolveRow key={`${it.userId}-${it.workDate}`} item={it} onResolve={u.resolve} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
