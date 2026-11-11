'use client'

import { useState } from 'react'
import { useMenuGuard, useTeamAttendance } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTime, fmtYmdShort, shiftMonth, statusLabel, statusTone, todayKst } from '@/lib/crm/client/format'

export default function V1TeamAttendance() {
  const allowed = useMenuGuard('attendance_team')
  const team = useTeamAttendance()
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', workDate: todayKst(), reason: '' })
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  if (!allowed) return null

  const [y, m] = team.month.split('-')
  const isCurrentMonth = team.month >= todayKst().slice(0, 7)

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

  return (
    <>
      <div className="page-head">
        <h1>직원근태</h1>
        <p className="muted">직원별 출근·지각·결근 횟수와 근무 시간입니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다.</p>
      </div>

      <section className="card">
        <h2>결근 처리</h2>
        <form className="row-form" onSubmit={submitAbsence}>
          <label className="field">
            <span>직원</span>
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">선택</option>
              {team.data?.rows.map((r) => (
                <option key={r.user.id} value={r.user.id}>
                  {r.user.name} ({r.user.loginId})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>날짜</span>
            <input type="date" value={form.workDate} max={todayKst()} onChange={(e) => setForm({ ...form, workDate: e.target.value })} />
          </label>
          <label className="field grow">
            <span>결근 사유</span>
            <input value={form.reason} maxLength={300} placeholder="예) 무단 결근, 병가 등" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          <button className="btn danger" disabled={saving}>
            {saving ? '처리 중…' : '결근 처리'}
          </button>
        </form>
        {msg && <p className={`msg ${msg.tone}`} role="status">{msg.text}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            {y}년 {Number(m)}월 근태 통계
          </h2>
          <div className="month-nav">
            <button className="btn ghost small" onClick={() => team.setMonth(shiftMonth(team.month, -1))}>
              ◀ 이전 달
            </button>
            <button className="btn ghost small" disabled={isCurrentMonth} onClick={() => team.setMonth(shiftMonth(team.month, 1))}>
              다음 달 ▶
            </button>
          </div>
        </div>
        {team.error && <p className="msg error">{team.error}</p>}
        {team.loading && !team.data ? (
          <p className="muted">불러오는 중…</p>
        ) : !team.data?.rows.length ? (
          <p className="empty">볼 수 있는 직원이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>직원</th>
                  <th>소속</th>
                  <th className="num">출근</th>
                  <th className="num">지각</th>
                  <th className="num">결근</th>
                  <th className="num">총 근무시간</th>
                </tr>
              </thead>
              <tbody>
                {team.data.rows.map((row) => {
                  const isOpen = openUser === row.user.id
                  const days = [...team.data!.days].reverse()
                  return [
                    <tr key={row.user.id} className="clickable" onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                      <td>
                        <strong>{row.user.name}</strong> <span className="muted small">{row.user.loginId}</span> <span className="muted small">{isOpen ? '▲' : '▼'}</span>
                      </td>
                      <td>{row.user.affiliationName || '-'}</td>
                      <td className="num">{row.summary.present}</td>
                      <td className="num">{row.summary.late}</td>
                      <td className="num">{row.summary.absent}</td>
                      <td className="num">{fmtMinutes(row.summary.workedMinutes)}</td>
                    </tr>,
                    isOpen && (
                      <tr key={`${row.user.id}-detail`} className="detail-row">
                        <td colSpan={6}>
                          <table className="table inner">
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
                                    <td>{fmtYmdShort(d)}</td>
                                    <td className="num">{fmtTime(r?.checkInAt)}</td>
                                    <td className="num">
                                      {fmtTime(r?.checkOutAt)}
                                      {r?.autoCheckout && <span className="muted small"> (자동)</span>}
                                    </td>
                                    <td className="num">{r?.checkInAt ? fmtMinutes(r.workedMinutes) : '-'}</td>
                                    <td>
                                      <span className={`badge tone-${statusTone(r)}`}>{statusLabel(r)}</span>
                                      {r?.status === 'absent' && <span className="muted small"> {r.absenceReason}</span>}
                                    </td>
                                    <td className="right">
                                      {r?.status === 'absent' ? (
                                        <button className="btn ghost small" onClick={() => cancel(row.user.id, d)}>
                                          결근 취소
                                        </button>
                                      ) : (
                                        <button
                                          className="btn ghost small"
                                          onClick={() => {
                                            setForm({ userId: row.user.id, workDate: d, reason: '' })
                                            window.scrollTo({ top: 0, behavior: 'smooth' })
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
                        </td>
                      </tr>
                    )
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
