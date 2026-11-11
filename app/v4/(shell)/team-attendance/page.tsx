'use client'

import { Fragment, useState } from 'react'
import { useMenuGuard, useTeamAttendance } from '@/lib/crm/client/hooks'
import { fmtMinutes, fmtTime, fmtYmdShort, shiftMonth, statusLabel, statusTone, todayKst } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead, Sticker, type MsgState } from '../../_components/ui'

export default function V4TeamAttendance() {
  const allowed = useMenuGuard('attendance_team')
  const team = useTeamAttendance()
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', workDate: todayKst(), reason: '' })
  const [msg, setMsg] = useState<MsgState>(null)
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
      <PageHead title="직원근태" tag="팀 현황" desc="직원별 출근·지각·결근 횟수와 근무 시간입니다. 이름을 누르면 날짜별 출퇴근 시간이 보입니다." />

      <section className="blk bg-pink-soft" id="v4-absence-form">
        <BlockTitle color="pink">결근 처리</BlockTitle>
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
          <button className="btn red" disabled={saving}>
            {saving ? '처리 중…' : '결근 처리'}
          </button>
        </form>
        {msg && (
          <Msg tone={msg.tone} live="status">
            {msg.text}
          </Msg>
        )}
      </section>

      <section className="blk">
        <BlockTitle
          color="yellow"
          right={
            <div className="month-nav">
              <button className="btn white sm" onClick={() => team.setMonth(shiftMonth(team.month, -1))}>
                ◀ 이전 달
              </button>
              <span className="month-pill">
                {y}.{m}
              </span>
              <button className="btn white sm" disabled={isCurrentMonth} onClick={() => team.setMonth(shiftMonth(team.month, 1))}>
                다음 달 ▶
              </button>
            </div>
          }
        >
          {y}년 {Number(m)}월 근태 통계
        </BlockTitle>
        {team.error && <Msg tone="error">{team.error}</Msg>}
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
                      <tr className={`clickable${isOpen ? ' open' : ''}`} onClick={() => setOpenUser(isOpen ? null : row.user.id)}>
                        <td>
                          <span className="toggle-box" aria-hidden="true">
                            {isOpen ? '−' : '+'}
                          </span>
                          <strong>{row.user.name}</strong> <span className="sub-id">{row.user.loginId}</span>
                        </td>
                        <td>{row.user.affiliationName || '-'}</td>
                        <td className="num">
                          <span className="count c-ok">{row.summary.present}</span>
                        </td>
                        <td className="num">
                          <span className="count c-late">{row.summary.late}</span>
                        </td>
                        <td className="num">
                          <span className="count c-absent">{row.summary.absent}</span>
                        </td>
                        <td className="num strong">{fmtMinutes(row.summary.workedMinutes)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="detail-row">
                          <td colSpan={6}>
                            <div className="detail-box">
                              <div className="detail-title">{row.user.name} · 날짜별 출퇴근</div>
                              <div className="tbl-wrap inner">
                                <table className="tbl tbl-inner">
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
                                          <td className="strong">{fmtYmdShort(d)}</td>
                                          <td className="num">{fmtTime(r?.checkInAt)}</td>
                                          <td className="num">
                                            {fmtTime(r?.checkOutAt)}
                                            {r?.autoCheckout && <span className="tag-mini">자동</span>}
                                          </td>
                                          <td className="num">{r?.checkInAt ? fmtMinutes(r.workedMinutes) : '-'}</td>
                                          <td>
                                            <Sticker tone={statusTone(r)}>{statusLabel(r)}</Sticker>
                                            {r?.status === 'absent' && <span className="reason">{r.absenceReason}</span>}
                                          </td>
                                          <td className="right">
                                            {r?.status === 'absent' ? (
                                              <button className="btn white sm" onClick={() => cancel(row.user.id, d)}>
                                                결근 취소
                                              </button>
                                            ) : (
                                              <button
                                                className="btn pink sm"
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
                            </div>
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
    </>
  )
}
