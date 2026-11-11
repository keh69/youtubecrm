'use client'

import { useState } from 'react'
import { TEAM_PERIODS, useMenuGuard, useTeamAttendance } from '@/lib/crm/client/hooks'
import { dayBadges, fmtMinutes, fmtTime, fmtYmdShort, statusLabel, statusTone, todayKst } from '@/lib/crm/client/format'
import { Prompt } from '../../term'
import { TeamCalendar } from '@/components/team-calendar'

export default function V8TeamAttendance() {
  const allowed = useMenuGuard('attendance_team')
  const team = useTeamAttendance()
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', workDate: todayKst(), reason: '' })
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
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

  const t = team.data?.totals

  return (
    <>
      <div className="page-head">
        <Prompt cmd={`team-attendance --period=${team.period}`} />
        <h1>직원근태 &gt; 근태통계</h1>
        <p className="muted">
          출근(지각 포함) · 지각(09:00 이후 출근) · 퇴근 · 야근(19:00 이후 퇴근) · 결근 횟수와 근무 시간입니다. 지각한 날은 출근과 지각이 함께, 야근한 날은 퇴근과 야근이 함께 1씩 올라갑니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다.
        </p>
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
          <div className="seg" role="tablist" aria-label="통계 기간">
            {TEAM_PERIODS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={team.period === p.key} className={team.period === p.key ? 'on' : ''} onClick={() => team.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="month-nav">
            <button className="btn ghost small" onClick={() => team.shift(-1)}>
              ◀ 이전
            </button>
            <button className="btn ghost small" onClick={team.goToday}>
              {team.period === 'week' ? '이번 주' : '이번 달'}
            </button>
            <button className="btn ghost small" disabled={!team.canGoNext} onClick={() => team.shift(1)}>
              다음 ▶
            </button>
          </div>
        </div>
        <h2>{team.data?.label || '근태 통계'}</h2>

        {t && (
          <div className="kpis six">
            <div className="kpi-mini">
              <span>출근</span>
              <strong>{t.present}</strong>
            </div>
            <div className="kpi-mini warn">
              <span>지각</span>
              <strong>{t.late}</strong>
            </div>
            <div className="kpi-mini">
              <span>퇴근</span>
              <strong>{t.checkedOut}</strong>
            </div>
            <div className="kpi-mini accent">
              <span>야근</span>
              <strong>{t.overtime}</strong>
            </div>
            <div className="kpi-mini bad">
              <span>결근</span>
              <strong>{t.absent}</strong>
            </div>
            <div className="kpi-mini">
              <span>총 근무시간</span>
              <strong>{fmtMinutes(t.workedMinutes)}</strong>
            </div>
          </div>
        )}

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
                    <tr key={row.user.id} className="clickable" onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                      <td>
                        <strong>{row.user.name}</strong> <span className="muted small">{row.user.loginId}</span> <span className="muted small">{isOpen ? '▲' : '▼'}</span>
                      </td>
                      <td>{row.user.affiliationName || '-'}</td>
                      <td className="num">{row.summary.present}</td>
                      <td className="num">{row.summary.late}</td>
                      <td className="num">{row.summary.checkedOut}</td>
                      <td className="num">{row.summary.overtime}</td>
                      <td className="num">{row.summary.absent}</td>
                      <td className="num">{fmtMinutes(row.summary.workedMinutes)}</td>
                    </tr>,
                    isOpen && (
                      <tr key={`${row.user.id}-detail`} className="detail-row">
                        <td colSpan={8}>
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
                                      {r?.autoCheckout ? <span className="xs-mini-unresolved">미처리</span> : fmtTime(r?.checkOutAt)}
                                    </td>
                                    <td className="num">{r?.checkInAt ? fmtMinutes(r.workedMinutes) : '-'}</td>
                                    <td>
                                      <span className={`badge tone-${statusTone(r)}`}>{statusLabel(r)}</span>
                                      {dayBadges(r).map((b) => (
                                        <span key={b.key} className={`badge tone-${b.key}`}>
                                          {b.label}
                                        </span>
                                      ))}
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
      {/* 맨 아래 달력: 날짜별 출근(지각)·퇴근(야근/미처리)과 시간, '수정가능' 권한이면 오른쪽 클릭으로 수정·삭제 */}
      {team.data && team.data.rows.length > 0 && <TeamCalendar data={team.data} team={team} />}
    </>
  )
}
