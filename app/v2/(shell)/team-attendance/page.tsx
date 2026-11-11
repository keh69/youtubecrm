'use client'

import { useRef, useState } from 'react'
import { TEAM_PERIODS, useMenuGuard, useTeamAttendance } from '@/lib/crm/client/hooks'
import { dayBadges, fmtMinutes, fmtTime, fmtYmdShort, todayKst } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, Panel, StatusTag, type Msg } from '../../_components/ui'

export default function V2TeamAttendance() {
  const allowed = useMenuGuard('attendance_team')
  const team = useTeamAttendance()
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', workDate: todayKst(), reason: '' })
  const [msg, setMsg] = useState<Msg>(null)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  if (!allowed) return null

  const submitAbsence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.userId) return setMsg({ tone: 'error', text: '직원을 선택해 주세요.' })
    if (!form.reason.trim()) return setMsg({ tone: 'error', text: '결근 사유를 입력해 주세요.' })
    setSaving(true)
    const res = await team.markAbsent(form.userId, form.workDate, form.reason.trim())
    setSaving(false)
    if (res.ok) {
      setMsg({ tone: 'ok', text: '결근으로 처리했습니다.' })
      setForm((f) => ({ ...f, reason: '' }))
    } else setMsg({ tone: 'error', text: res.error || '결근 처리 실패' })
  }

  const cancel = async (userId: string, workDate: string) => {
    if (!window.confirm(`${fmtYmdShort(workDate)} 결근을 취소할까요?`)) return
    const res = await team.cancelAbsence(userId, workDate)
    setMsg(res.ok ? { tone: 'ok', text: '결근을 취소했습니다.' } : { tone: 'error', text: res.error || '취소 실패' })
  }

  const totals = team.data?.totals

  return (
    <>
      <PageHead code="ATT-02" title="직원근태" desc="출근(지각 포함) · 지각(09:00 이후 출근) · 퇴근 · 야근(19:00 이후 퇴근) · 결근 횟수와 근무 시간입니다. 지각한 날은 출근과 지각이 함께, 야근한 날은 퇴근과 야근이 함께 1씩 올라갑니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다." />

      <div ref={formRef} className="anchor">
        <Panel label="결근 처리" className="panel-cmd">
          <form className="cmd-form" onSubmit={submitAbsence}>
            <label className="fld">
              <span className="lbl">직원</span>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                <option value="">선택</option>
                {team.data?.rows.map((r) => (
                  <option key={r.user.id} value={r.user.id}>
                    {r.user.name} ({r.user.loginId})
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span className="lbl">날짜</span>
              <input type="date" className="mono" value={form.workDate} max={todayKst()} onChange={(e) => setForm({ ...form, workDate: e.target.value })} />
            </label>
            <label className="fld grow">
              <span className="lbl">결근 사유</span>
              <input value={form.reason} maxLength={300} placeholder="예) 무단 결근, 병가 등" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            <button className="key danger" disabled={saving}>
              {saving ? '처리 중…' : '결근 처리'}
            </button>
          </form>
          <Note msg={msg} />
        </Panel>
      </div>

      <Panel
        label={team.data?.label || '근태 통계'}
        right={
          <>
            <div className="seg" role="tablist" aria-label="통계 기간">
              {TEAM_PERIODS.map((p) => (
                <button key={p.key} type="button" role="tab" aria-selected={team.period === p.key} className={team.period === p.key ? 'on' : ''} onClick={() => team.setPeriod(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="stepper">
              <button className="key ghost sm" onClick={() => team.shift(-1)}>
                ◀ 이전
              </button>
              <button className="key ghost sm" onClick={team.goToday}>
                {team.period === 'week' ? '이번 주' : '이번 달'}
              </button>
              <button className="key ghost sm" disabled={!team.canGoNext} onClick={() => team.shift(1)}>
                다음 ▶
              </button>
            </div>
          </>
        }
      >
        {team.error && <Note msg={{ tone: 'error', text: team.error }} />}
        {totals && (
          <div className="mini-stats six">
            <div className="c-ok">
              <span className="sect">출근</span>
              <strong className="mono">{totals.present}</strong>
            </div>
            <div className="c-late">
              <span className="sect">지각</span>
              <strong className="mono">{totals.late}</strong>
            </div>
            <div>
              <span className="sect">퇴근</span>
              <strong className="mono">{totals.checkedOut}</strong>
            </div>
            <div className="c-overtime">
              <span className="sect">야근</span>
              <strong className="mono">{totals.overtime}</strong>
            </div>
            <div className="c-absent">
              <span className="sect">결근</span>
              <strong className="mono">{totals.absent}</strong>
            </div>
            <div>
              <span className="sect">총 근무시간</span>
              <strong className="mono">{fmtMinutes(totals.workedMinutes)}</strong>
            </div>
          </div>
        )}
        {team.loading && !team.data ? (
          <Loading />
        ) : !team.data?.rows.length ? (
          <Empty>볼 수 있는 직원이 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>직원</th>
                  <th>소속</th>
                  <th className="num">출근</th>
                  <th className="num">지각</th>
                  <th className="num">퇴근</th>
                  <th className="num">야근</th>
                  <th className="num">결근</th>
                  <th className="num">총 근무시간</th>
                </tr>
              </thead>
              <tbody>
                {team.data.rows.map((row) => {
                  const isOpen = openUser === row.user.id
                  const days = [...team.data!.days].reverse()
                  return [
                    <tr key={row.user.id} className={`clickable ${isOpen ? 'open' : ''}`} onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                      <td>
                        <span className="caret-ind mono">{isOpen ? '▾' : '▸'}</span> <strong>{row.user.name}</strong> <span className="muted small mono">{row.user.loginId}</span>
                      </td>
                      <td>{row.user.affiliationName || '-'}</td>
                      <td className="num c-ok">{row.summary.present}</td>
                      <td className={`num ${row.summary.late ? 'c-late' : ''}`}>{row.summary.late}</td>
                      <td className="num">{row.summary.checkedOut}</td>
                      <td className={`num ${row.summary.overtime ? 'c-overtime' : ''}`}>{row.summary.overtime}</td>
                      <td className={`num ${row.summary.absent ? 'c-absent' : ''}`}>{row.summary.absent}</td>
                      <td className="num">{fmtMinutes(row.summary.workedMinutes)}</td>
                    </tr>,
                    isOpen && (
                      <tr key={`${row.user.id}-detail`} className="drill">
                        <td colSpan={8}>
                          <div className="drill-box">
                            <div className="sect">
                              {row.user.name} · 날짜별 출퇴근
                            </div>
                            <table className="tbl inner">
                              <thead>
                                <tr>
                                  <th>날짜</th>
                                  <th>출근</th>
                                  <th>퇴근</th>
                                  <th>근무</th>
                                  <th>상태 / 사유</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {days.map((d) => {
                                  const r = row.records[d]
                                  return (
                                    <tr key={d}>
                                      <td className="mono">{fmtYmdShort(d)}</td>
                                      <td className="mono">{fmtTime(r?.checkInAt)}</td>
                                      <td className="mono">
                                        {fmtTime(r?.checkOutAt)}
                                        {r?.autoCheckout && <span className="muted small"> (자동)</span>}
                                      </td>
                                      <td className="mono">{r?.checkInAt ? fmtMinutes(r.workedMinutes) : '-'}</td>
                                      <td>
                                        <StatusTag record={r} />
                                        {dayBadges(r).map((b) => (
                                          <span key={b.key} className={`tag flag-${b.key}`}>
                                            {b.label}
                                          </span>
                                        ))}
                                        {r?.status === 'absent' && <span className="muted small"> {r.absenceReason}</span>}
                                      </td>
                                      <td className="right">
                                        {r?.status === 'absent' ? (
                                          <button className="key ghost sm" onClick={() => cancel(row.user.id, d)}>
                                            결근 취소
                                          </button>
                                        ) : (
                                          <button
                                            className="key ghost sm warn"
                                            onClick={() => {
                                              setForm({ userId: row.user.id, workDate: d, reason: '' })
                                              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                            }}
                                          >
                                            결근 처리
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
