'use client'

import { useState } from 'react'
import { TEAM_PERIODS, useMenuGuard, useTeamAttendance, useWorkTimes } from '@/lib/crm/client/hooks'
import { dayBadges, fmtMinutes, fmtTime, fmtYmdShort, nowState, todayKst } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, StatusPill, type Msg } from '../../_components/ui'
import { TeamCalendar } from '@/components/team-calendar'

export default function V5TeamAttendance() {
  const allowed = useMenuGuard('attendance_team')
  const team = useTeamAttendance()
  const work = useWorkTimes() // 출퇴근 기준시간(설정 > 08)
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', workDate: todayKst(), time: '', reason: '' })
  const [msg, setMsg] = useState<Msg>(null)
  const [saving, setSaving] = useState<string | null>(null)
  if (!allowed) return null

  // 고른 직원·날짜의 지금 기록(보고 있는 기간 안일 때만 알 수 있다. 기간 밖이면 서버가 판단)
  const rec = form.userId ? team.data?.rows.find((r) => r.user.id === form.userId)?.records[form.workDate] : undefined
  const hasIn = Boolean(rec?.checkInAt)
  const hasOut = Boolean(rec?.checkOutAt && !rec?.autoCheckout)
  const closed = rec?.status === 'absent' || rec?.status === 'vacation'

  // 근태처리 버튼: 시간을 비우면 오늘은 지금 시각, 지난 날은 기본 시간(출근 = 출근 기준시간 · 지각 = +30분 · 퇴근 = 퇴근 기준시간 · 야근 = +2시간, 설정 > 08 출퇴근시간)
  const DEFAULT_TIME = work.defaults
  const LABEL = { in: '출근', in_late: '출근(지각)', out: '퇴근', out_overtime: '퇴근(야근)' } as const
  const nowHm = () => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  const apply = async (action: keyof typeof DEFAULT_TIME) => {
    if (!form.userId) return setMsg({ tone: 'error', text: '직원을 선택해 주세요.' })
    const time = form.time || (form.workDate === todayKst() ? nowHm() : DEFAULT_TIME[action])
    setSaving(action)
    const res = await team.applyDay(form.userId, form.workDate, action, time)
    setSaving(null)
    setMsg(res.ok ? { tone: 'ok', text: `${fmtYmdShort(form.workDate)} ${LABEL[action]} ${time} 으로 처리했습니다.` } : { tone: 'error', text: res.error || '처리하지 못했습니다.' })
  }

  const submitAbsence = async () => {
    if (!form.userId) return setMsg({ tone: 'error', text: '직원을 선택해 주세요.' })
    if (!form.reason.trim()) return setMsg({ tone: 'error', text: '결근 사유를 입력해 주세요.' })
    setSaving('absent')
    const res = await team.markAbsent(form.userId, form.workDate, form.reason.trim())
    setSaving(null)
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
      <PageHead emoji="👥" title="직원근태 > 근태통계" desc="출근(지각 포함) · 지각(출근 기준시간 이후 출근) · 퇴근 · 야근(퇴근 기준시간 이후 퇴근) · 결근 횟수와 근무 시간입니다. 지각한 날은 출근과 지각이 함께, 야근한 날은 퇴근과 야근이 함께 1씩 올라갑니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다." />

      <section className="g-glass" id="g-absence-form">
        <h2 className="g-h2">근태처리</h2>
        <p className="g-muted g-small">직원과 날짜를 고르고 버튼을 누르면 바로 적용됩니다. 이미 출근(퇴근) 기록이 있으면 출근(퇴근)은 적용되지 않고, 출근 기록이 있는 날은 결근 처리되지 않습니다. 이미 있는 기록을 고치려면 아래 달력에서 날짜를 오른쪽 클릭하세요.</p>
        <form className="g-row-form" onSubmit={(e) => e.preventDefault()}>
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
          <label className="g-field">
            <span>시간 (선택)</span>
            <input className="g-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-describedby="g-time-hint" />
          </label>
          <label className="g-field grow">
            <span>결근 사유 (결근 처리할 때)</span>
            <input className="g-input" value={form.reason} maxLength={300} placeholder="예) 무단 결근, 병가 등" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </form>
        <p id="g-time-hint" className="g-muted g-small">시간을 비우면 오늘은 지금 시각, 지난 날은 기본 시간(출근 = 출근 기준시간 · 지각 = +30분 · 퇴근 = 퇴근 기준시간 · 야근 = +2시간, 설정 &gt; 08 출퇴근시간)으로 들어갑니다.</p>
        <div className="g-apply-btns">
          {(['in', 'in_late'] as const).map((a) => (
            <button key={a} type="button" className="g-btn primary" disabled={saving !== null || hasIn || closed} title={hasIn ? '이미 출근 기록이 있습니다' : closed ? '결근·휴무로 처리된 날입니다' : ''} onClick={() => apply(a)}>
              {saving === a ? '처리 중…' : LABEL[a]}
            </button>
          ))}
          {(['out', 'out_overtime'] as const).map((a) => (
            <button key={a} type="button" className="g-btn ghost" disabled={saving !== null || (rec !== undefined && !hasIn) || hasOut || closed} title={hasOut ? '이미 퇴근 기록이 있습니다' : rec !== undefined && !hasIn ? '출근 기록이 없습니다' : ''} onClick={() => apply(a)}>
              {saving === a ? '처리 중…' : LABEL[a]}
            </button>
          ))}
          <button type="button" className="g-btn danger" disabled={saving !== null || hasIn || rec?.status === 'absent'} title={hasIn ? '출근 기록이 있어 결근 처리할 수 없습니다' : ''} onClick={submitAbsence}>
            {saving === 'absent' ? '처리 중…' : '결근 처리'}
          </button>
          {rec && (
            <span className="g-muted g-small">
              지금 기록: 출근 {fmtTime(rec.checkInAt)} · 퇴근 {rec.autoCheckout ? '미처리' : fmtTime(rec.checkOutAt)}
              {closed ? ` · ${rec.status === 'absent' ? '결근' : '휴무'}` : ''}
            </span>
          )}
        </div>
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
              {team.period === 'day' ? '오늘' : team.period === 'week' ? '이번 주' : '이번 달'}
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
              const days = team.data!.days // 날짜 오름차순
              const today = row.records[days[days.length - 1]] // '오늘' 보기일 때 그날 기록
              return (
                <li key={row.user.id} className={isOpen ? 'open' : ''}>
                  <button type="button" className="g-person" aria-expanded={isOpen} onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                    {(() => {
                      // 이름 왼쪽 동그라미 = 오늘 현재 상태 (출: 주황, 퇴: 짙은 회색, 미: 밝은 회색). 오늘이 없는 기간을 보면 이름 첫 글자.
                      if (!days.includes(todayKst())) return <span className="g-avatar sm">{row.user.name.slice(0, 1)}</span>
                      const st = nowState(row.records[todayKst()])
                      return (
                        <span className="g-avatar sm" style={{ background: st.bg, color: '#fff' }} title={st.title}>
                          {st.text}
                        </span>
                      )
                    })()}
                    <span className="g-person-name">
                      <strong>{row.user.name}</strong>
                      <small className="g-muted">
                        {row.user.loginId} · {row.user.affiliationName || '소속 없음'}
                      </small>
                    </span>
                    {team.period === 'day' ? (
                      // 오늘: 횟수 대신 오늘 출근·퇴근 시각과 근무시간
                      <span className="g-person-stats">
                        <span className="g-stat ok">
                          <small>출근</small>
                          <b>{fmtTime(today?.checkInAt)}</b>
                        </span>
                        <span className="g-stat out">
                          <small>퇴근</small>
                          <b>{today?.autoCheckout ? '미처리' : fmtTime(today?.checkOutAt)}</b>
                        </span>
                        <span className="g-stat time">
                          <small>근무시간</small>
                          <b>{today?.checkInAt ? fmtMinutes(today.workedMinutes) : '-'}</b>
                        </span>
                        <span className="g-badges">
                          <StatusPill record={today} />
                          {dayBadges(today).map((b) => (
                            <span key={b.key} className={`g-pill tone-${b.key}`}>
                              {b.label}
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : (
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
                    )}
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
                                  {r?.autoCheckout ? <span className="g-muted g-small">미처리</span> : fmtTime(r?.checkOutAt)}
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
                                        setForm({ userId: row.user.id, workDate: d, time: '', reason: '' })
                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                      }}
                                    >
                                      근태처리
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

      {/* 맨 아래 달력: 고른 직원의 날짜별 출근(지각)·퇴근(야근/미처리)과 시간 */}
      {team.data && team.data.rows.length > 0 && <TeamCalendar data={team.data} team={team} prefix="g-" sectionClass="g-glass" titleClass="g-h2" selectClass="g-input sm" />}
    </>
  )
}
