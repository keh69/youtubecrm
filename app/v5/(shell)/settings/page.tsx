'use client'

import { Fragment, useEffect, useState } from 'react'
import { MENUS, type MenuKey } from '@/lib/crm/menus'
import { SkinPicker } from '@/components/skin-picker'
import { CopyEmployeeFormButton } from '@/components/copy-employee-form'
import { RoleSettingsDetail } from '@/components/role-settings-detail'
import { AffiliationSelect } from '@/components/affiliation-select'
import { AttendanceEditToggle, StatsAllToggle, VideoPermToggles, WorkHoursPanel } from '@/components/settings-extra'
import { DumpTab } from './dump-tab'
import { UnresolvedTab } from './unresolved-tab'
import { DateInput, dottedToIso, isoToDotted } from '@/components/date-input'
import { EMPLOYEE_TABS_NOTE, EMPTY_ACCOUNT, SETTINGS_TAB_EVENT, useSettingsTabs, useEmployees, useMenuGuard, useSession, useSettings, useDragReorder, type SettingsTab } from '@/lib/crm/client/hooks'
import type { NewAccount, SettingsRole, SettingsUser } from '@/lib/crm/client/types'
import { Empty, Loading, Note, PageHead, type Msg } from '../../_components/ui'

export default function V5Settings() {
  const allowed = useMenuGuard('settings')
  const s = useSettings()
  const st = useSettingsTabs({ dump: true, unresolved: true, workhours: true }) // 역할별로 허용된 설정 하부 메뉴만(01~07)
  const [tabState, setTab] = useState<SettingsTab | null>(null)
  // 상단 미처리 알림에서 들어오면(?tab=unresolved 또는 이미 설정 화면이면 알림 이벤트) 그 탭을 연다
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q) setTab(q as SettingsTab)
    const open = (e: Event) => setTab((e as CustomEvent<SettingsTab>).detail)
    window.addEventListener(SETTINGS_TAB_EVENT, open)
    return () => window.removeEventListener(SETTINGS_TAB_EVENT, open)
  }, [])
  const tab: SettingsTab | null = st.tabs.length === 0 ? null : tabState && st.tabs.some((x) => x.key === tabState) ? tabState : st.first
  const [msg, setMsg] = useState<Msg>(null)
  if (!allowed) return null

  const report = (res: { ok: boolean; error?: string }, okText: string) => {
    setMsg(res.ok ? { tone: 'ok', text: okText } : { tone: 'error', text: res.error || '처리하지 못했습니다.' })
    return res.ok
  }

  return (
    <>
      <PageHead emoji="⚙️" title="설정" desc="역할을 만들고, 아이디마다 역할과 소속을 정하고, 역할별로 볼 수 있는 메뉴를 고릅니다." />

      {s.data && !s.data.migrated && (
        <Note
          msg={{
            tone: 'error',
            text: 'DB 업데이트가 필요합니다. supabase/sql/simple/200_simple_crm.sql 을 Supabase SQL Editor에서 실행해 주세요. (그 전에는 소속·역할부여·아이디생성이 저장되지 않습니다)'
          }}
          role="alert"
        />
      )}

      {s.data && s.data.migrated && !s.data.affiliationUserReady && (
        <Note msg={{ tone: 'error', text: 'DB 업데이트가 필요합니다. supabase/sql/simple/210_affiliation_user.sql 을 Supabase SQL Editor에서 실행해 주세요. (그 전에는 아이디 소속이 저장되지 않습니다)' }} role="alert" />
      )}

      <div className="g-tabs-wrap">
        <div className="g-tabs" role="tablist" aria-label="설정 메뉴">
          {st.tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'on' : ''}
              onClick={() => {
                setTab(t.key)
                setMsg(null)
              }}
            >
              <span className="g-tab-no">{t.no}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {st.tabs.length === 0 && <Note msg={{ tone: 'error', text: '설정 안에서 볼 수 있는 메뉴가 없습니다. 관리자에게 역할설정 > 설정 > 상세설정에서 켜 달라고 요청해 주세요.' }} />}
      <Note msg={msg} />
      {s.error && <Note msg={{ tone: 'error', text: s.error }} />}
      {s.loading && !s.data && <Loading />}

      {tab === 'employees' && <EmployeesTab />}
      {s.data && tab === 'assign' && <AssignTab s={s} report={report} />}
      {s.data && tab === 'roles' && <RolesTab s={s} report={report} />}
      {s.data && tab === 'create' && <CreateTab s={s} report={report} onDone={() => setTab('assign')} />}
      {tab === 'dump' && <DumpTab />}
      {tab === 'unresolved' && <UnresolvedTab />}
      {tab === 'workhours' && <WorkHoursPanel />}
      {tab === 'skin' && (
        <section className="g-glass">
          <SkinPicker />
        </section>
      )}
    </>
  )
}

/* ── 01 사원목록: 내 소속 하부 사원 + 그 아이디로 바로 로그인 ── */
function EmployeesTab() {
  const emp = useEmployees()
  const { me } = useSession()
  // 상세설정에서 이 역할에 켜 준 세부 권한(총 관리자는 항상 전부)
  const canEdit = (me.settingsTabs || []).includes('employees_edit')
  const canDelete = (me.settingsTabs || []).includes('employees_delete')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', hireDate: '' })
  const [editErr, setEditErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const cols = 8
  const startEdit = (u: { id: string; name: string; email: string; phone: string; hireDate: string | null }) => {
    setEditId(u.id)
    setForm({ name: u.name, email: u.email, phone: u.phone, hireDate: isoToDotted(u.hireDate) })
    setEditErr('')
  }
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    const hireDate = dottedToIso(form.hireDate)
    if (hireDate === null) {
      setEditErr('입사일자는 2026.11.11 처럼 적어 주세요.')
      return
    }
    setSaving(true)
    const res = await emp.editEmployee(editId, { ...form, hireDate })
    setSaving(false)
    if (res.ok) setEditId(null)
    else setEditErr(res.error || '저장하지 못했습니다.')
  }
  const remove = async (u: { id: string; name: string; loginId: string }) => {
    if (!window.confirm(`${u.name}(${u.loginId}) 아이디를 삭제할까요?

아이디는 더 이상 로그인할 수 없고, 이 사원의 근태·영상 기록은 06 덤프파일에 보관됩니다.`)) return
    setDeletingId(u.id)
    await emp.deleteEmployee(u.id, `${u.name}(${u.loginId})`)
    setDeletingId(null)
  }
  return (
    <section className="g-glass">
      <div className="copy-form-bar">
        <p className="g-hint">💡 {EMPLOYEE_TABS_NOTE}</p>
        <CopyEmployeeFormButton />
      </div>
      {emp.error && <Note msg={{ tone: 'error', text: emp.error }} role="alert" />}
      {emp.notice && <Note msg={{ tone: 'ok', text: emp.notice }} />}
      {emp.loading ? (
        <Loading />
      ) : emp.items.length === 0 ? (
        <Empty>내 소속 하부에 있는 사원이 없습니다. 02 역할부여에서 사원의 소속을 나(내 아이디)로 정해 주세요.</Empty>
      ) : (
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>입사일자</th>
                <th>소속</th>
                <th>역할</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {emp.items.map((u) => (
                <Fragment key={u.id}>
                <tr className={u.active ? '' : 'inactive'}>
                  <td className="nowrap">
                    <strong>{u.loginId}</strong>
                    {!u.active && <span className="g-pill tone-absent g-ml">사용중지</span>}
                  </td>
                  <td className="nowrap">{u.name}</td>
                  <td className="nowrap g-num">{isoToDotted(u.hireDate) || '-'}</td>
                  <td>{u.affiliationName || '-'}</td>
                  <td>{u.roles.join(', ') || '-'}</td>
                  <td className="nowrap">{u.phone || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td className="right nowrap">
                    <button
                      className="g-btn ghost sm"
                      disabled={u.isSuperAdmin || emp.resetId !== null}
                      title="비밀번호를 아이디와 같게 바꿉니다"
                      onClick={() => {
                        if (window.confirm(`${u.name}(${u.loginId})의 비밀번호를 아이디와 같게(${u.loginId}) 초기화할까요?`)) void emp.resetPassword(u.id)
                      }}
                    >
                      {emp.resetId === u.id ? '초기화 중…' : '비밀번호 초기화'}
                    </button>{' '}
                    <button className="g-btn primary sm" disabled={!u.active || u.isSuperAdmin || emp.busyId !== null} onClick={() => emp.loginAs(u.id)}>
                      {emp.busyId === u.id ? '들어가는 중…' : '이 아이디로 로그인'}
                    </button>
                    {canEdit && (
                      <>
                        {' '}
                        <button className="g-btn ghost sm" disabled={u.isSuperAdmin && !me.isSuperAdmin} aria-expanded={editId === u.id} onClick={() => (editId === u.id ? setEditId(null) : startEdit(u))}>
                          {editId === u.id ? '닫기' : '편집'}
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <>
                        {' '}
                        <button className="g-btn danger sm" disabled={u.isSuperAdmin || deletingId !== null} onClick={() => remove(u)}>
                          {deletingId === u.id ? '삭제 중…' : '삭제'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {editId === u.id && (
                  <tr className="g-edit-row">
                    <td colSpan={cols}>
                      <form className="g-emp-edit" onSubmit={saveEdit}>
                        <label className="g-field">
                          <span>이름</span>
                          <input className="g-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </label>
                        <label className="g-field">
                          <span>입사일자</span>
                          <DateInput className="g-input" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} ariaLabel="입사일자" />
                        </label>
                        <label className="g-field">
                          <span>이메일 (비우면 그대로)</span>
                          <input className="g-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </label>
                        <label className="g-field">
                          <span>전화번호</span>
                          <input className="g-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
                        </label>
                        <div className="g-emp-edit-actions">
                          <button className="g-btn primary sm" disabled={saving}>
                            {saving ? '저장 중…' : '저장'}
                          </button>
                          <button type="button" className="g-btn ghost sm" onClick={() => setEditId(null)}>
                            취소
                          </button>
                        </div>
                        {editErr && <p className="g-msg error g-emp-edit-err">{editErr}</p>}
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// 상세설정 표의 칸 이름: '직원근태'는 '근태통계'로 보여 준다(v5)
const colLabel = (m: { key: string; label: string }) => (m.key === 'attendance_team' ? '근태통계' : m.label)

type S = ReturnType<typeof useSettings>
type Report = (res: { ok: boolean; error?: string }, okText: string) => boolean

/* ── 역할부여: 아이디별 역할 추가/제거 + 소속 + 계정 정보 ── */
function AssignTab({ s, report }: { s: S; report: Report }) {
  const { me } = useSession()
  const [editId, setEditId] = useState<string | null>(null)
  const roles = s.data!.roles
  return (
    <section className="g-glass">
      <p className="g-hint">
        💡 <strong>소속</strong>에서 사람(아이디)을 고르면 그 사람 밑으로 들어가, 그 사람이 로그인했을 때 이 직원의 영상·통계·근태를 볼 수 있습니다. 위로 계속 이어집니다(팀원 → 팀장 → 관리자). 소속 목록에는 역할별로 그 역할이 적용된 아이디만 나옵니다.
      </p>
      <ul className="g-accounts">
        {s.data!.users.map((u) => {
          const open = editId === u.id
          return (
            <li key={u.id} className={`${u.active ? '' : 'inactive'} ${open ? 'open' : ''}`}>
              <div className="g-account">
                <div className="g-account-id">
                  <span className="g-avatar sm">{(u.name || u.loginId).slice(0, 1)}</span>
                  <span>
                    <strong>{u.name}</strong>
                    <small className="g-muted">
                      {u.loginId}
                      {!u.active && <span className="g-pill tone-absent g-ml">사용중지</span>}
                    </small>
                  </span>
                </div>
                <div className="g-account-roles">
                  <small className="g-label">역할</small>
                  <RoleChips user={u} roles={roles} onChange={async (ids) => report(await s.setUserRoles(u.id, ids), `${u.name}님의 역할을 저장했습니다.`)} />
                </div>
                <label className="g-account-aff">
                  <small className="g-label">소속</small>
                  <AffiliationSelect
                    data={s.data!}
                    className="g-input sm"
                    value={u.affiliationUserId}
                    legacyRoleId={u.affiliationRoleId}
                    excludeId={u.id}
                    onChange={async (id) => report(await s.updateAccount(u.id, { affiliationUserId: id }), `${u.name}님의 소속을 저장했습니다.`)}
                  />
                </label>
                <button className="g-btn ghost sm g-account-toggle" aria-expanded={open} onClick={() => setEditId(open ? null : u.id)}>
                  {open ? '닫기' : '정보 수정'}
                </button>
              </div>
              {open && <AccountEditor user={u} isMe={u.id === me.id} s={s} report={report} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RoleChips({ user, roles, onChange }: { user: SettingsUser; roles: SettingsRole[]; onChange: (ids: string[]) => void }) {
  // 역할은 아이디마다 1개만: 역할이 없을 때만 [＋ 역할 추가]가 보인다.
  // 총 관리자는 [역할 추가]와 × 버튼을 모두 숨긴다(실수로 빼지 않게).
  const owned = roles.filter((r) => user.roleIds.includes(r.id))
  const rest = roles.filter((r) => !user.roleIds.includes(r.id))
  const isSuper = owned.some((r) => r.locked)
  return (
    <div className="g-chips">
      {owned.length === 0 && <span className="g-muted g-small">역할 없음</span>}
      {owned.map((r) => (
        <span key={r.id} className="g-chip role">
          {r.name}
          {!isSuper && (
            <button aria-label={`${r.name} 역할 제거`} onClick={() => onChange(user.roleIds.filter((id) => id !== r.id))}>
              ×
            </button>
          )}
        </span>
      ))}
      {owned.length === 0 && rest.length > 0 && (
        <select className="g-chip-add" value="" onChange={(e) => e.target.value && onChange([...user.roleIds, e.target.value])} aria-label="역할 추가">
          <option value="">＋ 역할 추가</option>
          {rest.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function AccountEditor({ user, isMe, s, report }: { user: SettingsUser; isMe: boolean; s: S; report: Report }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, password: '' })
  const [busy, setBusy] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const patch: Record<string, string> = { name: form.name, email: form.email, phone: form.phone }
    if (form.password) patch.password = form.password
    if (report(await s.updateAccount(user.id, patch), '계정 정보를 저장했습니다.')) setForm((f) => ({ ...f, password: '' }))
    setBusy(false)
  }
  return (
    <form className="g-editor" onSubmit={save}>
      <div className="g-grid-form">
        <label className="g-field">
          <span>이름</span>
          <input className="g-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="g-field">
          <span>이메일</span>
          <input className="g-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="g-field">
          <span>전화번호</span>
          <input className="g-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="g-field">
          <span>새 비밀번호(바꿀 때만)</span>
          <input className="g-input" type="password" value={form.password} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
      </div>
      <div className="g-editor-actions">
        {!isMe && (
          <button
            type="button"
            className={`g-btn ${user.active ? 'soft-danger' : 'ghost'}`}
            onClick={async () => {
              if (user.active && !window.confirm(`${user.name}님 계정을 사용 중지할까요? 로그인할 수 없게 됩니다.`)) return
              report(await s.updateAccount(user.id, { active: !user.active }), user.active ? '사용 중지했습니다.' : '다시 사용하도록 했습니다.')
            }}
          >
            {user.active ? '사용 중지' : '사용 재개'}
          </button>
        )}
        <button className="g-btn primary" disabled={busy}>
          저장
        </button>
      </div>
    </form>
  )
}

/* ── 역할설정: 역할 추가/이름변경/삭제 + 볼 수 있는 메뉴 스위치 ── */
function RolesTab({ s, report }: { s: S; report: Report }) {
  const [name, setName] = useState('')
  const drag = useDragReorder(s.data!.roles, async (ids) => report(await s.reorderRoles(ids), '역할 순서를 저장했습니다.'))
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const toggle = async (role: SettingsRole, key: MenuKey) => {
    const next = role.menus.includes(key) ? role.menus.filter((k) => k !== key) : [...role.menus, key]
    report(await s.saveRoleMenus(role.id, next), `'${role.name}' 메뉴 권한을 저장했습니다.`)
  }

  const saveRename = async (id: string) => {
    if (!renaming) return
    if (report(await s.renameRole(id, renaming.name.trim()), '역할 이름을 바꿨습니다.')) setRenaming(null)
  }

  return (
    <>
      <section className="g-glass">
        <h2 className="g-h2">역할 추가</h2>
        <form
          className="g-row-form"
          onSubmit={async (e) => {
            e.preventDefault()
            if (report(await s.createRole(name.trim()), `'${name.trim()}' 역할을 만들었습니다.`)) setName('')
          }}
        >
          <label className="g-field grow">
            <span>역할 이름</span>
            <input className="g-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예) A팀장" maxLength={30} />
          </label>
          <button className="g-btn primary" disabled={!name.trim()}>
            ＋ 추가
          </button>
        </form>
      </section>

      <section className="g-glass">
        <h2 className="g-h2">상세설정</h2>
        <p className="g-muted g-small">체크한 메뉴만 보입니다. 여러 역할을 가진 사람은 모든 역할의 메뉴를 합쳐서 봅니다. 왼쪽 ⠿ 부분을 마우스로 끌어 놓으면 역할 순서가 바뀌고 바로 저장됩니다.</p>
        {/* 회원가입·아이디 만들기에서 새 아이디가 받는 역할. 이 역할은 삭제할 수 없다(삭제 자리에 '가입역할' 표시) */}
        <label className="g-signup-role">
          <span>회원가입 시 역할 :</span>
          <select
            className="g-input sm"
            value={s.data!.roles.find((r) => r.signupRole)?.id || ''}
            onChange={async (e) => {
              const role = s.data!.roles.find((r) => r.id === e.target.value)
              if (role) report(await s.setSignupRole(role.id), `회원가입 시 역할을 '${role.name}'(으)로 정했습니다.`)
            }}
            aria-label="회원가입 시 역할"
          >
            {!s.data!.roles.some((r) => r.signupRole) && <option value="">(역할 없음)</option>}
            {s.data!.roles
              .filter((r) => !r.locked)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <div className="g-table-wrap">
          <table className="g-table g-matrix">
            <thead>
              <tr>
                <th className="drag-col" aria-label="순서" />
                <th>역할</th>
                {MENUS.map((m) => (
                  <th key={m.key} className="center" title={m.description}>
                    {colLabel(m)}
                  </th>
                ))}
                <th className="num">보유 / 소속</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drag.items.map((r) => (
                <tr key={r.id} {...drag.rowProps(r.id)} className={`drag-row${drag.draggingId === r.id ? ' dragging' : ''}`}>
                  <td className="drag-col" title="끌어서 순서 바꾸기" aria-hidden="true">
                    ⠿
                  </td>
                  <td>
                    {renaming?.id === r.id ? (
                      <span className="g-inline-edit">
                        <input
                          className="g-input sm"
                          value={renaming.name}
                          onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveRename(r.id)
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          maxLength={30}
                          autoFocus
                          aria-label="역할 이름"
                        />
                        <button className="g-btn primary sm" onClick={() => saveRename(r.id)}>
                          저장
                        </button>
                        <button className="g-btn ghost sm" onClick={() => setRenaming(null)}>
                          취소
                        </button>
                      </span>
                    ) : (
                      <span className="g-role-name">
                        <strong>{r.name}</strong>
                        {r.locked && <small className="g-muted"> (항상 전체)</small>}
                      </span>
                    )}
                  </td>
                  {MENUS.map((m) => (
                    <td key={m.key} className="center">
                      <label className="g-switch" title={`${r.name} - ${colLabel(m)}`}>
                        <input type="checkbox" checked={r.menus.includes(m.key)} disabled={r.locked} onChange={() => toggle(r, m.key)} aria-label={`${r.name} - ${colLabel(m)}`} />
                        <span aria-hidden="true" />
                      </label>
                      {m.key === 'settings' && <RoleSettingsDetail role={r} onSave={(id, tabs) => s.saveRoleSettingsTabs(id, tabs)} onSaveAffiliation={(id, v) => s.saveRoleAffiliation(id, v)} />}
                      {m.key === 'attendance_team' && <AttendanceEditToggle role={r} s={s} report={report} />}
                      {m.key === 'stats' && <StatsAllToggle role={r} s={s} report={report} />}
                      {m.key === 'videos' && <VideoPermToggles role={r} s={s} report={report} />}
                    </td>
                  ))}
                  <td className="num">
                    {r.holderCount} / {r.memberCount}
                  </td>
                  <td className="right nowrap">
                    {!r.locked && (
                      <button className="g-btn ghost sm" onClick={() => setRenaming({ id: r.id, name: r.name })}>
                        이름 변경
                      </button>
                    )}
                    {!r.system && r.signupRole && (
                      <button className="g-btn signup sm g-ml g-slot" title="회원가입·아이디 만들기에서 새 아이디가 받는 역할이라 삭제할 수 없습니다. 바꾸려면 위의 '회원가입 시 역할'에서 다른 역할을 고르세요." onClick={() => document.querySelector<HTMLSelectElement>('.g-signup-role select')?.focus()}>
                        가입역할
                      </button>
                    )}
                    {!r.system && !r.signupRole && (
                      <button
                        className="g-btn soft-danger sm g-ml g-slot"
                        onClick={async () => {
                          if (!window.confirm(`'${r.name}' 역할을 삭제할까요? 이 역할을 가진 사람에게서 빠지고, 이 역할이 소속인 직원은 소속이 비워집니다.`)) return
                          report(await s.deleteRole(r.id), '역할을 삭제했습니다.')
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="g-muted g-small">보유 = 이 역할을 가진 사람 수, 소속 = 이 역할 밑에 소속된 직원 수</p>
      </section>
    </>
  )
}

/* ── 아이디생성 ── */
function CreateTab({ s, report, onDone }: { s: S; report: Report; onDone: () => void }) {
  const [form, setForm] = useState<NewAccount>(EMPTY_ACCOUNT)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof NewAccount, v: string) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <section className="g-glass">
      <h2 className="g-h2">아이디 만들기</h2>
      <p className="g-muted g-small">여기서 만든 아이디와 비밀번호로 바로 로그인할 수 있습니다. 새 아이디는 기본으로 &lsquo;{s.data!.roles.find((r) => r.signupRole)?.name || '사원'}&rsquo; 역할을 받습니다.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const ok = report(await s.createAccount(form), `'${form.loginId}' 아이디를 만들었습니다.`)
          setBusy(false)
          if (ok) {
            setForm(EMPTY_ACCOUNT)
            onDone()
          }
        }}
      >
        <div className="g-grid-form">
          <label className="g-field">
            <span>아이디 (ID) *</span>
            <input className="g-input" value={form.loginId} onChange={(e) => set('loginId', e.target.value)} autoComplete="off" placeholder="영문/숫자" />
          </label>
          <label className="g-field">
            <span>비밀번호 (PW) *</span>
            <input className="g-input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" placeholder="4자 이상" />
          </label>
          <label className="g-field">
            <span>이름 *</span>
            <input className="g-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="g-field">
            <span>이메일 (선택)</span>
            <input className="g-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label className="g-field">
            <span>전화번호</span>
            <input className="g-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
          </label>
          <label className="g-field">
            <span>소속</span>
            <AffiliationSelect data={s.data!} listedOnly className="g-input" value={form.affiliationUserId || null} onChange={(id) => setForm((f) => ({ ...f, affiliationUserId: id, affiliationRoleId: null }))} />
          </label>
        </div>
        <div className="g-editor-actions">
          <button className="g-btn primary lg" disabled={busy}>
            {busy ? '만드는 중…' : '아이디 생성'}
          </button>
        </div>
      </form>
    </section>
  )
}
