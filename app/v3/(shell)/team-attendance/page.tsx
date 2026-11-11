'use client'

import { Fragment, useState } from 'react'
import { TEAM_PERIODS, useMenuGuard, useTeamAttendance } from '@/lib/crm/client/hooks'
import { dayBadges, fmtMinutes, fmtTime, fmtYmdShort, todayKst } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, Stamp, type Msg } from '../../_components/ui'
import { TeamCalendar } from '@/components/team-calendar'

export default function V3TeamAttendance() {
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
      <PageHead kicker="주간·월간 근태 보고" title="직원근태 > 근태통계">
        출근(지각 포함) · 지각(09:00 이후 출근) · 퇴근 · 야근(19:00 이후 퇴근) · 결근 횟수와 근무 시간입니다. 지각한 날은 출근과 지각이 함께, 야근한 날은 퇴근과 야근이 함께 1씩 올라갑니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다.
      </PageHead>

      <section className="j-section" id="v3-absence">
        <h2 className="j-h2">결근 처리</h2>
        <form className="j-form-row" onSubmit={submitAbsence}>
          <label className="j-field">
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
          <label className="j-field">
            <span>날짜</span>
            <input type="date" value={form.workDate} max={todayKst()} onChange={(e) => setForm({ ...form, workDate: e.target.value })} />
          </label>
          <label className="j-field grow">
            <span>결근 사유</span>
            <input value={form.reason} maxLength={300} placeholder="예) 무단 결근, 병가 등" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          <button className="j-btn danger" disabled={saving}>
            {saving ? '처리 중…' : '결근 처리'}
          </button>
        </form>
        <Note msg={msg} />
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <div className="j-section-head">
          <div className="j-linkset" role="tablist" aria-label="통계 기간">
            {TEAM_PERIODS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={team.period === p.key} className={team.period === p.key ? 'on' : ''} onClick={() => team.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="j-pager">
            <button type="button" className="j-textbtn" onClick={() => team.shift(-1)}>
              ◀ 이전
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" className="j-textbtn" onClick={team.goToday}>
              {team.period === 'week' ? '이번 주' : '이번 달'}
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" className="j-textbtn" disabled={!team.canGoNext} onClick={() => team.shift(1)}>
              다음 ▶
            </button>
          </div>
        </div>
        <h2 className="j-h2">{team.data?.label || '근태 통계'}</h2>

        {t && (
          <dl className="j-tally">
            <div>
              <dt>출근</dt>
              <dd>{t.present}</dd>
            </div>
            <div className="late">
              <dt>지각</dt>
              <dd>{t.late}</dd>
            </div>
            <div>
              <dt>퇴근</dt>
              <dd>{t.checkedOut}</dd>
            </div>
            <div className="overtime">
              <dt>야근</dt>
              <dd>{t.overtime}</dd>
            </div>
            <div className="absent">
              <dt>결근</dt>
              <dd>{t.absent}</dd>
            </div>
            <div>
              <dt>총 근무시간</dt>
              <dd>{fmtMinutes(t.workedMinutes)}</dd>
            </div>
          </dl>
        )}

        {team.error && <Note msg={{ tone: 'error', text: team.error }} />}
        {team.loading && !team.data ? (
          <Loading />
        ) : !team.data?.rows.length ? (
          <Empty>볼 수 있는 직원이 없습니다.</Empty>
        ) : (
          <div className="j-table-wrap">
            <table className="j-table">
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
                  return (
                    <Fragment key={row.user.id}>
                      <tr className={`j-clickable ${isOpen ? 'open' : ''}`} onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                        <td>
                          <button type="button" className="j-name-btn" aria-expanded={isOpen}>
                            <strong>{row.user.name}</strong> <small>{row.user.loginId}</small> <span className="j-caret">{isOpen ? '▴' : '▾'}</span>
                          </button>
                        </td>
                        <td>{row.user.affiliationName || '-'}</td>
                        <td className="num">{row.summary.present}</td>
                        <td className="num late">{row.summary.late}</td>
                        <td className="num">{row.summary.checkedOut}</td>
                        <td className="num overtime">{row.summary.overtime}</td>
                        <td className="num absent">{row.summary.absent}</td>
                        <td className="num">{fmtMinutes(row.summary.workedMinutes)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="j-detail">
                          <td colSpan={8}>
                            <table className="j-table inner">
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
                                      <td className="num nowrap">
                                        {r?.autoCheckout ? <span className="xs-mini-unresolved">미처리</span> : fmtTime(r?.checkOutAt)}
                                      </td>
                                      <td className="num nowrap">{r?.checkInAt ? fmtMinutes(r.workedMinutes) : '-'}</td>
                                      <td>
                                        <Stamp record={r} />
                                        {dayBadges(r).map((b) => (
                                          <span key={b.key} className={`j-mark ${b.key}`}>
                                            {b.label}
                                          </span>
                                        ))}
                                        {r?.status === 'absent' && <small className="j-reason"> {r.absenceReason}</small>}
                                      </td>
                                      <td className="right nowrap">
                                        {r?.status === 'absent' ? (
                                          <button type="button" className="j-textbtn" onClick={() => cancel(row.user.id, d)}>
                                            결근 취소
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="j-textbtn danger"
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
                      )}
                    </Fragment>
                  )
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
