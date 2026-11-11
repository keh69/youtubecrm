'use client'

// v5 설정에만 있던 기능을 다른 스킨(v1~v4, v6~v11)에도 똑같이 쓰기 위한 공용 부품.
// 스킨마다 색이 달라서 글자색(currentColor)을 따라가는 중립 디자인(xs-*)으로 그린다. 스타일은 app/globals.css.
//  - EmployeeManage: 사원목록 [편집] [삭제] (상세설정 세부 권한)
//  - DumpPanel: 06 덤프파일 (삭제된 사원의 근태·영상 기록, CSV, 영상 담당자 변경)
//  - UnresolvedPanel: 07 미처리 (출근미처리·퇴근미처리 처리)
//  - SignupRoleSelect: 상세설정 '회원가입 시 역할'
//  - UnresolvedAlert: 미처리가 있으면 화면 위에 늘 뜨는 알림
//  - useSettingsTabFromUrl: ?tab= 이나 알림 버튼으로 설정 탭 열기

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SETTINGS_TAB_EVENT,
  useDump,
  useSession,
  useUnresolved,
  useUnresolvedCount,
  useWorkTimes,
  type ResolveAction,
  type SettingsTab,
  type UnresolvedItem,
  useEmployees,
  useSettings
} from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtHourMin, fmtNumber, fmtTime, fmtTimeSec, fmtYmdShort, statusLabel } from '@/lib/crm/client/format'
import { DateInput, dottedToIso, isoToDotted } from '@/components/date-input'
import { api } from '@/lib/crm/client/api'

type Emp = ReturnType<typeof useEmployees>
type S = ReturnType<typeof useSettings>
type Report = (res: { ok: boolean; error?: string }, okText: string) => boolean

/* ───────── 설정 탭을 주소(?tab=)나 알림 버튼으로 열기 ───────── */
export function useSettingsTabFromUrl(setTab: (t: SettingsTab) => void) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q) setTab(q as SettingsTab)
    const open = (e: Event) => setTab((e as CustomEvent<SettingsTab>).detail)
    window.addEventListener(SETTINGS_TAB_EVENT, open)
    return () => window.removeEventListener(SETTINGS_TAB_EVENT, open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ───────── 사원목록 [편집] [삭제] ───────── */
export function EmployeeManage({ user, emp, btnClass }: { user: Emp['items'][number]; emp: Emp; btnClass: string }) {
  const { me } = useSession()
  const canEdit = (me.settingsTabs || []).includes('employees_edit')
  const canDelete = (me.settingsTabs || []).includes('employees_delete')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', hireDate: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!canEdit && !canDelete) return null

  const startEdit = () => {
    setForm({ name: user.name, email: user.email, phone: user.phone, hireDate: isoToDotted(user.hireDate) })
    setErr('')
    setOpen(true)
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const hireDate = dottedToIso(form.hireDate)
    if (hireDate === null) return setErr('입사일자는 2026.11.11 처럼 적어 주세요.')
    setBusy(true)
    const res = await emp.editEmployee(user.id, { ...form, hireDate })
    setBusy(false)
    if (res.ok) setOpen(false)
    else setErr(res.error || '저장하지 못했습니다.')
  }
  const remove = async () => {
    if (!window.confirm(`${user.name}(${user.loginId}) 아이디를 삭제할까요?\n\n아이디는 더 이상 로그인할 수 없고, 이 사원의 근태·영상 기록은 06 덤프파일에 보관됩니다.`)) return
    setBusy(true)
    await emp.deleteEmployee(user.id, `${user.name}(${user.loginId})`)
    setBusy(false)
  }

  return (
    <>
      {canEdit && (
        <>
          {' '}
          <button className={btnClass} disabled={(user.isSuperAdmin && !me.isSuperAdmin) || busy} onClick={startEdit}>
            편집
          </button>
        </>
      )}
      {canDelete && (
        <>
          {' '}
          <button className={`${btnClass} xs-danger`} disabled={user.isSuperAdmin || busy} onClick={remove}>
            {busy && !open ? '삭제 중…' : '삭제'}
          </button>
        </>
      )}
      {open &&
        createPortal(
        <div className="xs-modal-back" onClick={() => setOpen(false)}>
          <form className="xs-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} aria-label={`${user.name} 정보 편집`}>
            <h3>
              {user.name} <small>({user.loginId})</small> 정보 편집
            </h3>
            <label className="xs-field">
              <span>이름</span>
              <input className="xs-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </label>
            <label className="xs-field">
              <span>입사일자</span>
              <DateInput className="xs-input" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} ariaLabel="입사일자" />
            </label>
            <label className="xs-field">
              <span>이메일 (비우면 그대로)</span>
              <input className="xs-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="xs-field">
              <span>전화번호</span>
              <input className="xs-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
            </label>
            {err && <p className="xs-err">{err}</p>}
            <div className="xs-actions">
              <button type="button" className="xs-btn" onClick={() => setOpen(false)}>
                취소
              </button>
              <button className="xs-btn primary" disabled={busy}>
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </div>,
          document.body
        )}
    </>
  )
}

/* ───────── 상세설정: 회원가입 시 역할 ───────── */
export function SignupRoleSelect({ s, report }: { s: S; report: Report }) {
  const roles = s.data?.roles || []
  return (
    <label className="xs-signup-role">
      <span>회원가입 시 역할 :</span>
      <select
        className="xs-input sm"
        value={roles.find((r) => r.signupRole)?.id || ''}
        onChange={async (e) => {
          const role = roles.find((r) => r.id === e.target.value)
          if (role) report(await s.setSignupRole(role.id), `회원가입 시 역할을 '${role.name}'(으)로 정했습니다.`)
        }}
        aria-label="회원가입 시 역할"
      >
        {!roles.some((r) => r.signupRole) && <option value="">(역할 없음)</option>}
        {roles
          .filter((r) => !r.locked)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </select>
    </label>
  )
}

/* ───────── 미처리 알림(화면 위에 늘 뜸) ───────── */
export function UnresolvedAlert({ base }: { base: string }) {
  const { me } = useSession()
  const count = useUnresolvedCount((me.settingsTabs || []).includes('unresolved'))
  const pending = count ? count.checkIn + count.checkOut : 0
  if (!pending) return null
  return (
    <div className="xs-alert" role="alert">
      <span className="xs-alert-dot" aria-hidden="true" />
      <span className="xs-alert-text">
        <b>근태 미처리 {pending}건</b>
        <small>
          출근미처리 {count!.checkIn}건 · 퇴근미처리 {count!.checkOut}건
        </small>
      </span>
      <Link href={`${base}/settings?tab=unresolved`} className="xs-btn primary" onClick={() => window.dispatchEvent(new CustomEvent(SETTINGS_TAB_EVENT, { detail: 'unresolved' }))}>
        처리하러 가기
      </Link>
    </div>
  )
}

/* ───────── 06 덤프파일 ───────── */
const SHOW_MAX = 300
function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => {
    const t = String(v ?? '')
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const text = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
const today = () => new Date().toISOString().slice(0, 10)

export function DumpPanel() {
  const dump = useDump()
  const [who, setWho] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [owner, setOwner] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const d = dump.data
  const att = useMemo(() => (d?.attendance || []).filter((r) => !who || r.userId === who), [d, who])
  const vids = useMemo(() => (d?.videos || []).filter((v) => !who || v.ownerId === who), [d, who])
  const allPicked = vids.length > 0 && vids.every((v) => picked.has(v.id))

  if (dump.loading) return <div className="xs-panel">불러오는 중…</div>
  if (dump.error) return <div className="xs-panel xs-err">{dump.error}</div>
  if (!d) return null

  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const reassign = async () => {
    const ids = vids.filter((v) => picked.has(v.id)).map((v) => v.id)
    if (!ids.length || !owner) return
    const name = d.assignees.find((a) => a.id === owner)?.name || ''
    if (!window.confirm(`고른 영상 ${ids.length}개의 담당자를 ${name}님으로 바꿀까요?`)) return
    setBusy(true)
    const res = await dump.reassign(ids, owner)
    setBusy(false)
    setMsg(res.ok ? { ok: true, text: res.text || '담당자를 바꿨습니다.' } : { ok: false, text: res.error || '바꾸지 못했습니다.' })
    if (res.ok) setPicked(new Set())
  }

  return (
    <div className="xs-panel">
      <h3 className="xs-h">06 덤프파일</h3>
      <p className="xs-muted">삭제된 사원의 근태 기록과 영상 기록이 여기에 보관됩니다. 이름은 &lsquo;홍길동(전)&rsquo;으로 보입니다. 영상은 골라서 다른 사원에게 담당자를 넘길 수 있고, CSV 파일로 내려받을 수 있습니다.</p>
      {d.people.length === 0 ? (
        <p className="xs-empty">삭제된 사원이 없습니다.</p>
      ) : (
        <>
          <div className="xs-bar">
            <select className="xs-input" value={who} onChange={(e) => (setWho(e.target.value), setPicked(new Set()))} aria-label="사원">
              <option value="">삭제된 사원 전체 ({d.people.length}명)</option>
              {d.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.loginId} · 삭제 {fmtDate(p.deletedAt)}
                </option>
              ))}
            </select>
            <span className="xs-chip">근태 {fmtNumber(att.length)}건</span>
            <span className="xs-chip">영상 {fmtNumber(vids.length)}개</span>
          </div>
          {msg && <p className={msg.ok ? 'xs-ok' : 'xs-err'}>{msg.text}</p>}

          <div className="xs-head">
            <h4>영상기록</h4>
            <button className="xs-btn" disabled={!vids.length} onClick={() => downloadCsv(`영상기록_${today()}.csv`, ['담당자', '종목명', '제목', '주소', '업로드일', '조회수', '길이(초)'], vids.map((v) => [v.ownerName, v.stockName, v.title, v.url, fmtDate(v.publishedAt || v.createdAt), v.viewCount, v.durationSeconds ?? '']))}>
              ⬇ CSV 내려받기
            </button>
          </div>
          {vids.length === 0 ? (
            <p className="xs-empty">보관된 영상이 없습니다.</p>
          ) : (
            <>
              <div className="xs-bar">
                <span>
                  <b>{vids.filter((v) => picked.has(v.id)).length}</b>개 선택
                </span>
                <select className="xs-input" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="새 담당자">
                  <option value="">새 담당자 고르기</option>
                  {d.assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.loginId})
                    </option>
                  ))}
                </select>
                <button className="xs-btn primary" disabled={busy || !owner || !vids.some((v) => picked.has(v.id))} onClick={reassign}>
                  {busy ? '바꾸는 중…' : '담당자 변경'}
                </button>
              </div>
              <div className="xs-table-wrap">
                <table className="xs-table">
                  <thead>
                    <tr>
                      <th>
                        <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(vids.map((v) => v.id)))} aria-label="영상 전체 선택" />
                      </th>
                      <th>담당자</th>
                      <th>종목명</th>
                      <th>제목</th>
                      <th>업로드일</th>
                      <th className="num">조회수</th>
                      <th className="num">길이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vids.slice(0, SHOW_MAX).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <input type="checkbox" checked={picked.has(v.id)} onChange={() => togglePick(v.id)} aria-label={`${v.title} 선택`} />
                        </td>
                        <td className="nowrap">{v.ownerName}</td>
                        <td className="nowrap">{v.stockName}</td>
                        <td>
                          <a href={v.url} target="_blank" rel="noreferrer">
                            {v.title}
                          </a>
                        </td>
                        <td className="nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                        <td className="num">{fmtNumber(v.viewCount)}</td>
                        <td className="num">{fmtDuration(v.durationSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vids.length > SHOW_MAX && <p className="xs-muted">최근 {SHOW_MAX}개만 보입니다. 전체 기록은 CSV로 내려받으세요.</p>}
            </>
          )}

          <div className="xs-head">
            <h4>근태기록</h4>
            <button className="xs-btn" disabled={!att.length} onClick={() => downloadCsv(`근태기록_${today()}.csv`, ['이름', '날짜', '출근', '퇴근', '근무시간(분)', '상태', '결근사유'], att.map((r) => [r.name, r.workDate, fmtTimeSec(r.checkInAt), fmtTimeSec(r.checkOutAt), r.workedMinutes, statusLabel(r), r.absenceReason || '']))}>
              ⬇ CSV 내려받기
            </button>
          </div>
          {att.length === 0 ? (
            <p className="xs-empty">보관된 근태 기록이 없습니다.</p>
          ) : (
            <div className="xs-table-wrap">
              <table className="xs-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>날짜</th>
                    <th>출근</th>
                    <th>퇴근</th>
                    <th className="num">근무시간</th>
                    <th>상태</th>
                    <th>결근 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {att.slice(0, SHOW_MAX).map((r) => (
                    <tr key={`${r.userId}-${r.workDate}`}>
                      <td className="nowrap">{r.name}</td>
                      <td className="nowrap">{fmtYmdShort(r.workDate)}</td>
                      <td className="nowrap">{fmtTimeSec(r.checkInAt)}</td>
                      <td className="nowrap">{fmtTimeSec(r.checkOutAt)}</td>
                      <td className="num">{r.checkInAt ? fmtHourMin(r.workedMinutes) : '-'}</td>
                      <td className="nowrap">{statusLabel(r)}</td>
                      <td>{r.absenceReason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ───────── 07 미처리 ───────── */
// 처리 방법별 기본 시간은 출퇴근 기준시간(설정 > 08)을 따른다
type ActionDef = { key: ResolveAction; label: string; time: string | null }
function useResolveActions(): { IN_ACTIONS: ActionDef[]; OUT_ACTIONS: ActionDef[] } {
  const d = useWorkTimes().defaults
  return {
    IN_ACTIONS: [
      { key: 'in', label: '출근', time: d.in },
      { key: 'in_late', label: '출근(지각)', time: d.in_late },
      { key: 'absent', label: '결근', time: null },
      { key: 'off', label: '휴무', time: null }
    ],
    OUT_ACTIONS: [
      { key: 'out', label: '퇴근', time: d.out },
      { key: 'out_overtime', label: '퇴근(야근)', time: d.out_overtime }
    ]
  }
}

function ResolveRow({ item, onResolve }: { item: UnresolvedItem; onResolve: ReturnType<typeof useUnresolved>['resolve'] }) {
  const { IN_ACTIONS, OUT_ACTIONS } = useResolveActions()
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
        <b>{fmtYmdShort(item.workDate)}</b>
      </td>
      <td className="nowrap">
        {item.name} <small className="xs-muted">({item.loginId})</small>
      </td>
      {item.kind === 'out' && <td className="nowrap">{fmtTime(item.checkInAt)}</td>}
      <td>
        <div className="xs-resolve">
          <span className="xs-seg" role="radiogroup" aria-label="처리 방법">
            {actions.map((a) => (
              <button key={a.key} type="button" role="radio" aria-checked={action === a.key} className={action === a.key ? 'on' : ''} onClick={() => pick(a.key)}>
                {a.label}
              </button>
            ))}
          </span>
          {current.time ? (
            <input className="xs-input sm" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="시간" />
          ) : (
            <input className="xs-input sm" value={note} maxLength={300} placeholder={action === 'absent' ? '결근 사유(선택)' : '휴무 사유(선택)'} onChange={(e) => setNote(e.target.value)} aria-label="사유" />
          )}
          <button className="xs-btn primary" disabled={busy || (Boolean(current.time) && !time)} onClick={submit}>
            {busy ? '처리 중…' : '처리'}
          </button>
        </div>
        {err && <p className="xs-err">{err}</p>}
      </td>
    </tr>
  )
}

export function UnresolvedPanel() {
  const u = useUnresolved()
  if (u.loading && !u.data) return <div className="xs-panel">불러오는 중…</div>
  if (u.error) return <div className="xs-panel xs-err">{u.error}</div>
  const d = u.data!
  const table = (list: UnresolvedItem[], out: boolean) => (
    <div className="xs-table-wrap">
      <table className="xs-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>직원</th>
            {out && <th>출근</th>}
            <th>처리</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it) => (
            <ResolveRow key={`${it.userId}-${it.workDate}`} item={it} onResolve={u.resolve} />
          ))}
        </tbody>
      </table>
    </div>
  )
  return (
    <div className="xs-panel">
      <h3 className="xs-h">07 미처리</h3>
      <p className="xs-muted">
        최근 2주({fmtYmdShort(d.from)} ~ {fmtYmdShort(d.to)}) 동안 평일(월~금)에 출근을 안 누른 날과, 퇴근을 안 눌러 23:59에 자동 퇴근된 날입니다. 오늘 출근은 출근 기준시간(설정 &gt; 08)이 지나야 나타납니다. 출근·출근(지각)·퇴근·퇴근(야근)·결근·휴무 중 하나로 처리하면 목록에서 사라집니다.
      </p>
      <h4>
        출근미처리 <span className="xs-chip">{d.checkIn.length}건</span>
      </h4>
      {d.checkIn.length === 0 ? <p className="xs-empty">출근미처리가 없습니다.</p> : table(d.checkIn, false)}
      <h4>
        퇴근미처리 <span className="xs-chip">{d.checkOut.length}건</span>
      </h4>
      {d.checkOut.length === 0 ? <p className="xs-empty">퇴근미처리가 없습니다.</p> : table(d.checkOut, true)}
    </div>
  )
}

/* ───────── 역할설정 표: '근태통계' 스위치 옆 '수정가능' 체크칸 ───────── */
// 켜진 역할은 근태통계 달력에서 날짜를 오른쪽 클릭해 근태를 고치거나 지울 수 있다. 근태통계가 켜진 역할에만 보인다.
export function AttendanceEditToggle({ role, s, report }: { role: NonNullable<S['data']>['roles'][number]; s: S; report: Report }) {
  if (!role.menus.includes('attendance_team')) return null
  const on = Boolean(role.locked || role.attendanceEdit)
  return (
    <label className="xs-att-edit" title="켜면 근태통계 달력에서 날짜를 오른쪽 클릭해 근태를 고치거나 지울 수 있습니다">
      <input
        type="checkbox"
        className="rsd-chk"
        checked={on}
        disabled={role.locked}
        onChange={async () => report(await s.saveRoleAttendanceEdit(role.id, !on), `'${role.name}' 근태 수정 권한을 ${on ? '껐' : '켰'}습니다.`)}
        aria-label={`${role.name} - 근태통계 수정가능`}
      />
      수정가능
    </label>
  )
}

/* ───────── 역할설정 표: '영상통계' 스위치 옆 '관리자' 체크칸 ───────── */
// 켜진 역할은 영상통계에서 전 직원의 영상을 보고, 꺼져 있으면 내가 올린 영상만 본다.
export function StatsAllToggle({ role, s, report }: { role: NonNullable<S['data']>['roles'][number]; s: S; report: Report }) {
  if (!role.menus.includes('stats')) return null
  const on = Boolean(role.locked || role.statsAll)
  return (
    <label className="xs-att-edit" title="켜면 영상통계에서 전 직원의 영상을 봅니다. 끄면 내가 올린 영상만 봅니다.">
      <input
        type="checkbox"
        className="rsd-chk"
        checked={on}
        disabled={role.locked}
        onChange={async () => report(await s.saveRoleStatsAll(role.id, !on), `'${role.name}' 영상통계를 ${on ? '내 영상만' : '전 직원'} 보도록 바꿨습니다.`)}
        aria-label={`${role.name} - 영상통계 관리자`}
      />
      관리자
    </label>
  )
}

/* ───────── 08 출퇴근시간(지각·야근 기준) ───────── */
export function WorkHoursPanel() {
  const work = useWorkTimes()
  const [start, setStart] = useState(work.start)
  const [end, setEnd] = useState(work.end)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (end <= start) return setMsg({ ok: false, text: '퇴근 기준시간은 출근 기준시간보다 늦어야 합니다.' })
    setBusy(true)
    const res = await api<{ start: string; end: string }>('/api/settings/work-hours', { method: 'PUT', body: { start, end } })
    setBusy(false)
    if (!res.ok) return setMsg({ ok: false, text: res.error })
    setMsg({ ok: true, text: `저장했습니다. 출근 ${res.data.start} 이후 = 지각, 퇴근 ${res.data.end} 이후 = 야근. 다른 화면은 새로고침하면 바로 반영됩니다.` })
  }
  return (
    <form className="xs-panel" onSubmit={save}>
      <h3 className="xs-h">08 출퇴근시간</h3>
      <p className="xs-muted">
        출근 기준시간 이후에 출근하면 <b>지각</b>, 퇴근 기준시간 이후에 퇴근하면 <b>야근</b>으로 표시됩니다(23:59 자동 퇴근은 야근이 아니라 퇴근(미처리)). 근태처리·미처리 버튼의 기본 시간도 이 기준을 따릅니다. 바꾸면 지난 기록의 지각·야근 표시도 새 기준으로 다시 계산됩니다.
      </p>
      <div className="xs-bar">
        <label className="xs-field">
          <span>출근 기준시간</span>
          <input className="xs-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="xs-field">
          <span>퇴근 기준시간</span>
          <input className="xs-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
        <button className="xs-btn primary" disabled={busy} style={{ alignSelf: 'flex-end' }}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
      {msg && <p className={msg.ok ? 'xs-ok' : 'xs-err'}>{msg.text}</p>}
    </form>
  )
}
