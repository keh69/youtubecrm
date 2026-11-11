'use client'

import { useState } from 'react'
import { TEAM_PERIODS, useMenuGuard, useTeamAttendance } from '@/lib/crm/client/hooks'
import { dayBadges, fmtMinutes, fmtTime, fmtYmdShort, todayKst } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, StatusPill, type Msg } from '../../_components/ui'

export default function V5TeamAttendance() {
  const allowed = useMenuGuard('attendance_team')
  const team = useTeamAttendance()
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', workDate: todayKst(), reason: '' })
  const [msg, setMsg] = useState<Msg>(null)
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
      <PageHead emoji="👥" title="직원근태" desc="출근(지각 포함) · 지각(09:00 이후 출근) · 퇴근 · 야근(19:00 이후 퇴근) · 결근 횟수와 근무 시간입니다. 지각한 날은 출근과 지각이 함께, 야근한 날은 퇴근과 야근이 함께 1씩 올라갑니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다." />

      <section className="g-glass" id="g-absence-form">
        <h2 className="g-h2">결근 처리</h2>
        <form className="g-row-form" onSubmit={submitAbsence}>
          <label className="g-field">
            <span>직원</span>
            <select className="g-input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">선택</option>
              {team.data?.rows.map((r) => (
                <option key={r.user.id} value={r.user.id}>
                  {r.user.name} ({r.user.loginId})
                </option>
              ))}
            </select>
          </label>
          <label className="g-field">
            <span>날짜</span>
            <input className="g-input" type="date" value={form.workDate} max={todayKst()} onChange={(e) => setForm({ ...form, workDate: e.target.value })} />
          </label>
          <label className="g-field grow">
            <span>결근 사유</span>
            <input className="g-input" value={form.reason} maxLength={300} placeholder="예) 무단 결근, 병가 등" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          <button className="g-btn danger" disabled={saving}>
            {saving ? '처리 중…' : '결근 처리'}
          </button>
        </form>
        <Note msg={msg} />
      </section>

      <section className="g-glass">
        <div className="g-card-head">
          <div className="g-seg" role="tablist" aria-label="통계 기간">
            {TEAM_PERIODS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={team.period === p.key} className={team.period === p.key ? 'on' : ''} onClick={() => team.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="g-month-nav">
            <button className="g-btn ghost sm" onClick={() => team.shift(-1)}>
              ◀ 이전
            </button>
            <button className="g-btn ghost sm" onClick={team.goToday}>
              {team.period === 'week' ? '이번 주' : '이번 달'}
            </button>
            <button className="g-btn ghost sm" disabled={!team.canGoNext} onClick={() => team.shift(1)}>
              다음 ▶
            </button>
          </div>
        </div>
        <h2 className="g-h2 g-period-title">{team.data?.label || '근태 통계'}</h2>

        {t && (
          <div className="g-totals">
            <span className="g-stat ok">
              <small>출근</small>
              <b>{t.present}</b>
            </span>
            <span className="g-stat late">
              <small>지각</small>
              <b>{t.late}</b>
            </span>
            <span className="g-stat out">
              <small>퇴근</small>
              <b>{t.checkedOut}</b>
            </span>
            <span className="g-stat overtime">
              <small>야근</small>
              <b>{t.overtime}</b>
            </span>
            <span className="g-stat absent">
              <small>결근</small>
              <b>{t.absent}</b>
            </span>
            <span className="g-stat time">
              <small>총 근무시간</small>
              <b>{fmtMinutes(t.workedMinutes)}</b>
            </span>
          </div>
        )}

        {team.error && <Note msg={{ tone: 'error', text: team.error }} />}
        {team.loading && !team.data ? (
          <Loading />
        ) : !team.data?.rows.length ? (
          <Empty>볼 수 있는 직원이 없습니다.</Empty>
        ) : (
          <ul className="g-people">
            {team.data.rows.map((row) => {
              const isOpen = openUser === row.user.id
              const days = [...team.data!.days].reverse()
              return (
                <li key={row.user.id} className={isOpen ? 'open' : ''}>
                  <button type="button" className="g-person" aria-expanded={isOpen} onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                    <span className="g-avatar sm">{row.user.name.slice(0, 1)}</span>
                    <span className="g-person-name">
                      <strong>{row.user.name}</strong>
                      <small className="g-muted">
                        {row.user.loginId} · {row.user.affiliationName || '소속 없음'}
                      </small>
                    </span>
                    <span className="g-person-stats">
                      <span className="g-stat ok">
                        <small>출근</small>
                        <b>{row.summary.present}</b>
                      </span>
                      <span className="g-stat late">
                        <small>지각</small>
                        <b>{row.summary.late}</b>
                      </span>
                      <span className="g-stat out">
                        <small>퇴근</small>
                        <b>{row.summary.checkedOut}</b>
                      </span>
                      <span className="g-stat overtime">
                        <small>야근</small>
                        <b>{row.summary.overtime}</b>
                      </span>
                      <span className="g-stat absent">
                        <small>결근</small>
                        <b>{row.summary.absent}</b>
                      </span>
                      <span className="g-stat time">
                        <small>총 근무시간</small>
                        <b>{fmtMinutes(row.summary.workedMinutes)}</b>
                      </span>
                    </span>
                    <span className="g-chev" aria-hidden="true">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="g-table-wrap g-person-detail">
                      <table className="g-table">
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
                                <td className="nowrap">{fmtYmdShort(d)}</td>
                                <td className="num">{fmtTime(r?.checkInAt)}</td>
                                <td className="num">
                                  {fmtTime(r?.checkOutAt)}
                                  {r?.autoCheckout && <span className="g-muted g-small"> (자동)</span>}
                                </td>
                                <td className="num">{r?.checkInAt ? fmtMinutes(r.workedMinutes) : '-'}</td>
                                <td>
                                  <span className="g-badges">
                                    <StatusPill record={r} />
                                    {dayBadges(r).map((b) => (
                                      <span key={b.key} className={`g-pill tone-${b.key}`}>
                                        {b.label}
                                      </span>
                                    ))}
                                  </span>
                                  {r?.status === 'absent' && <span className="g-muted g-small"> {r.absenceReason}</span>}
                                </td>
                                <td className="right">
                                  {r?.status === 'absent' ? (
                                    <button className="g-btn ghost sm" onClick={() => cancel(row.user.id, d)}>
                                      결근 취소
                                    </button>
                                  ) : (
                                    <button
                                      className="g-btn soft-danger sm"
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
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
