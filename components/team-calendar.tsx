'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, fmtTime, todayKst, fmtYmdShort } from '@/lib/crm/client/format'
import { useSession, useWorkTimes, type useTeamAttendance } from '@/lib/crm/client/hooks'
import type { DayRecord, TeamAttendance } from '@/lib/crm/client/types'

// 근태통계 맨 아래 달력(모든 스킨 공통).
// - 고른 직원의 날짜별 출근(지각)·퇴근(야근/미처리)과 시간, 결근·휴무, 오늘 근무 중
// - 역할설정에서 근태통계 '수정가능'이 켜진 사람은 날짜를 오른쪽 클릭하면 [수정] [삭제] 가 뜨고, 그날 근태를 모두 고칠 수 있다.
// prefix: v5 는 'g-'(v5 디자인), 다른 스킨은 'xs-'(글자색을 따라가는 기본 디자인, app/globals.css)

type Team = ReturnType<typeof useTeamAttendance>
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function lastDayOfMonth(ymd: string) {
  const [y, m] = ymd.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${ymd.slice(0, 7)}-${String(d).padStart(2, '0')}`
}
const dow = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay()
// ISO → KST "HH:MM"
const toHm = (iso: string | null) => (iso ? fmtTime(iso).replace(/^24:/, '00:') : '')

type Kind = 'normal' | 'absent' | 'vacation'

function EditDialog({ name, date, record, onClose, onSave }: { name: string; date: string; record: DayRecord | undefined; onClose: () => void; onSave: (v: { kind: Kind; checkIn: string | null; checkOut: string | null; reason: string }) => Promise<string | null> }) {
  const [kind, setKind] = useState<Kind>(record?.status === 'absent' ? 'absent' : record?.status === 'vacation' ? 'vacation' : 'normal')
  const [checkIn, setCheckIn] = useState(toHm(record?.checkInAt || null))
  const [checkOut, setCheckOut] = useState(record?.autoCheckout ? '' : toHm(record?.checkOutAt || null))
  const [reason, setReason] = useState(record?.absenceReason || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const work = useWorkTimes() // 출퇴근 기준시간(설정 > 08)
  const late = kind === 'normal' && Boolean(checkIn) && checkIn > work.start
  const overtime = kind === 'normal' && Boolean(checkOut) && checkOut > work.end

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const error = await onSave({ kind, checkIn: kind === 'normal' ? checkIn || null : null, checkOut: kind === 'normal' ? checkOut || null : null, reason })
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <div className="xs-modal-back" onClick={onClose}>
      <form className="xs-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} aria-label={`${name} ${date} 근태 수정`}>
        <h3>
          {name} · {fmtYmdShort(date)} 근태 수정
        </h3>
        <div className="xs-seg" role="radiogroup" aria-label="구분">
          {(
            [
              ['normal', '출근·퇴근'],
              ['absent', '결근'],
              ['vacation', '휴무']
            ] as Array<[Kind, string]>
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
        {kind === 'normal' ? (
          <>
            <label className="xs-field">
              <span>
                출근 시간 {late && <em className="xs-tag late">지각</em>}
              </span>
              <input className="xs-input" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} autoFocus />
            </label>
            <label className="xs-field">
              <span>
                퇴근 시간 (비우면 퇴근 전) {overtime && <em className="xs-tag overtime">야근</em>}
              </span>
              <input className="xs-input" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </label>
            <p className="xs-muted">{work.start} 이후 출근은 지각, {work.end} 이후 퇴근은 야근으로 자동 표시됩니다. 둘 다 비우면 기록 없음으로 저장됩니다.</p>
          </>
        ) : (
          <label className="xs-field">
            <span>{kind === 'absent' ? '결근 사유' : '휴무 사유'}</span>
            <input className="xs-input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'absent' ? '예) 병가, 무단 결근' : '예) 공휴일, 연차'} autoFocus />
          </label>
        )}
        {err && <p className="xs-err">{err}</p>}
        <div className="xs-actions">
          <button type="button" className="xs-btn" onClick={onClose}>
            취소
          </button>
          <button className="xs-btn primary" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function TeamCalendar({ data, team, prefix = 'xs-', sectionClass = 'xs-panel', titleClass = 'xs-h', selectClass = 'xs-input sm' }: { data: TeamAttendance; team: Team; prefix?: string; sectionClass?: string; titleClass?: string; selectClass?: string }) {
  const { me } = useSession()
  const canEdit = Boolean(me.canEditAttendance)
  const [userId, setUserId] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; date: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const row = data.rows.find((r) => r.user.id === userId) || data.rows[0]

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  if (!row) return null
  const c = (name: string) => `${prefix}${name}`
  const start = data.from
  const end = data.period === 'week' ? addDays(start, 6) : lastDayOfMonth(start)
  const cells: Array<string | null> = []
  for (let i = 0; i < dow(start); i++) cells.push(null)
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const today = todayKst()

  const remove = async (date: string) => {
    setMenu(null)
    if (!window.confirm(`${row.user.name}님의 ${fmtYmdShort(date)} 근태 기록을 지울까요?`)) return
    const res = await team.deleteDay(row.user.id, date)
    setMsg(res.ok ? `${fmtYmdShort(date)} 근태 기록을 지웠습니다.` : res.error || '지우지 못했습니다.')
  }

  return (
    <section className={sectionClass}>
      <div className={c('cal-top')}>
        <h2 className={titleClass}>달력 · {data.label}</h2>
        <select className={selectClass} value={row.user.id} onChange={(e) => setUserId(e.target.value)} aria-label="달력에서 볼 직원">
          {data.rows.map((r) => (
            <option key={r.user.id} value={r.user.id}>
              {r.user.name} ({r.user.loginId})
            </option>
          ))}
        </select>
      </div>
      {canEdit && <p className={c('cal-hint')}>날짜를 마우스 오른쪽 버튼으로 누르면 그날 근태를 수정하거나 삭제할 수 있습니다.</p>}
      {msg && <p className={c('cal-hint')}>{msg}</p>}
      <div className={c('cal')} role="grid" aria-label={`${row.user.name} 근태 달력`}>
        {WEEK.map((w, i) => (
          <div key={w} className={`${c('cal-head')}${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`} role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className={`${c('cal-cell')} empty`} />
          const r = row.records[d]
          const future = d > today
          const wd = dow(d)
          return (
            <div
              key={d}
              className={`${c('cal-cell')}${d === today ? ' today' : ''}${future ? ' future' : ''}${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}${canEdit && !future ? ' editable' : ''}`}
              role="gridcell"
              onContextMenu={(e) => {
                if (!canEdit || future) return
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, date: d })
              }}
            >
              <span className={c('cal-day')}>{Number(d.slice(8))}</span>
              {r?.status === 'absent' ? (
                <span className={`${c('cal-line')} absent`} title={r.absenceReason || ''}>
                  결근{r.absenceReason ? ` · ${r.absenceReason}` : ''}
                </span>
              ) : r?.status === 'vacation' ? (
                <span className={`${c('cal-line')} off`}>휴무{r.absenceReason ? ` · ${r.absenceReason}` : ''}</span>
              ) : (
                <>
                  {r?.checkInAt && (
                    <span className={`${c('cal-line')} in`}>
                      출근 <b>{fmtTime(r.checkInAt)}</b>
                      {r.late && <i className={`${c('cal-tag')} late`}>지각</i>}
                    </span>
                  )}
                  {r?.checkOutAt && (
                    <span className={`${c('cal-line')} out`}>
                      {r.autoCheckout ? (
                        <i className={`${c('cal-tag')} unresolved`}>퇴근(미처리)</i>
                      ) : (
                        <>
                          퇴근 <b>{fmtTime(r.checkOutAt)}</b>
                          {r.overtime && <i className={`${c('cal-tag')} overtime`}>야근</i>}
                        </>
                      )}
                    </span>
                  )}
                  {r?.checkInAt && !r.checkOutAt && d === today && <span className={`${c('cal-line')} working`}>근무 중</span>}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* 오른쪽 클릭 메뉴·수정 창은 body 에 그린다. 카드에 흐림 효과(backdrop-filter)가 있으면 fixed 위치가 카드 기준으로 바뀌어 커서에서 떨어져 보였다 */}
      {menu &&
        createPortal(
        <div className="xs-ctx" style={{ left: Math.min(menu.x, window.innerWidth - 150), top: Math.min(menu.y, window.innerHeight - 100) }} role="menu" onClick={(e) => e.stopPropagation()}>
          <div className="xs-ctx-title">{fmtYmdShort(menu.date)}</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setEditing(menu.date)
              setMenu(null)
            }}
          >
            ✏️ 수정
          </button>
          <button type="button" role="menuitem" className="danger" disabled={!row.records[menu.date]} onClick={() => remove(menu.date)}>
            🗑 삭제
          </button>
        </div>,
          document.body
        )}

      {editing &&
        createPortal(
        <EditDialog
          name={row.user.name}
          date={editing}
          record={row.records[editing]}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const res = await team.editDay({ userId: row.user.id, workDate: editing, ...v })
            if (!res.ok) return res.error || '저장하지 못했습니다.'
            setMsg(`${fmtYmdShort(editing)} 근태를 수정했습니다.`)
            setEditing(null)
            return null
          }}
        />,
          document.body
        )}
    </section>
  )
}
