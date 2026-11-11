'use client'

import { useState } from 'react'
import { MENUS, type MenuKey } from '@/lib/crm/menus'
import { SkinPicker } from '@/components/skin-picker'
import { RoleSettingsDetail } from '@/components/role-settings-detail'
import { EMPLOYEE_TABS_NOTE, EMPTY_ACCOUNT, useDragReorder, useSettingsTabs, useEmployees, useMenuGuard, useSession, useSettings, type SettingsTab } from '@/lib/crm/client/hooks'
import type { NewAccount, SettingsRole, SettingsUser } from '@/lib/crm/client/types'
import { GridFoot, Ico, RowNoTh, Th } from '../../_ui'
import { CopyEmployeeFormButton } from '@/components/copy-employee-form'

type Tab = SettingsTab
type Msg = { tone: 'ok' | 'error'; text: string } | null

export default function V9Settings() {
  const allowed = useMenuGuard('settings')
  const s = useSettings()
  const st = useSettingsTabs() // 역할별로 허용된 설정 하부 메뉴만
  const [tabState, setTab] = useState<Tab | null>(null)
  const tab: Tab = tabState && st.tabs.some((x) => x.key === tabState) ? tabState : st.first
  const [msg, setMsg] = useState<Msg>(null)
  if (!allowed) return null

  const report = (res: { ok: boolean; error?: string }, okText: string) => {
    setMsg(res.ok ? { tone: 'ok', text: okText } : { tone: 'error', text: res.error || '처리하지 못했습니다.' })
    return res.ok
  }

  return (
    <>
      <div className="page-head">
        <h1>설정</h1>
        <p className="muted">역할을 만들고, 아이디마다 역할과 소속을 정하고, 역할별로 볼 수 있는 메뉴를 고릅니다.</p>
      </div>

      {s.data && !s.data.migrated && (
        <p className="msg error">DB 업데이트가 필요합니다. supabase/sql/simple/200_simple_crm.sql 을 Supabase SQL Editor에서 실행해 주세요. (그 전에는 소속·역할부여·아이디생성이 저장되지 않습니다)</p>
      )}

      <div className="tabs" role="tablist">
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
            <span className="tab-no">{t.no}</span> {t.label}
          </button>
        ))}
      </div>

      {msg && <p className={`msg ${msg.tone}`} role="status">{msg.text}</p>}
      {s.error && <p className="msg error">{s.error}</p>}
      {s.loading && !s.data && <p className="muted">불러오는 중…</p>}

      {tab === 'employees' && <EmployeesTab />}
      {s.data && tab === 'assign' && <AssignTab s={s} report={report} />}
      {s.data && tab === 'roles' && <RolesTab s={s} report={report} />}
      {s.data && tab === 'create' && <CreateTab s={s} report={report} onDone={() => setTab('assign')} />}
      {tab === 'skin' && (
        <section className="card">
          <SkinPicker />
        </section>
      )}
    </>
  )
}

/* ── 01 사원목록: 내 소속 하부 사원 + 그 아이디로 바로 로그인 ── */
function EmployeesTab() {
  const emp = useEmployees()
  return (
    <section className="card">
      <div className="copy-form-bar">
        <p className="muted small">{EMPLOYEE_TABS_NOTE}</p>
        <CopyEmployeeFormButton />
      </div>
      {emp.error && <p className="msg error">{emp.error}</p>}
      {emp.notice && <p className="msg ok" role="status">{emp.notice}</p>}
      {emp.loading ? (
        <p className="muted">불러오는 중…</p>
      ) : emp.items.length === 0 ? (
        <p className="empty">내 소속 하부에 있는 사원이 없습니다. 02 역할부여에서 사원의 소속을 내 역할로 정해 주세요.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <RowNoTh />
                  <Th name="아이디" type="varchar" />
                  <Th name="이름" type="text" />
                  <Th name="소속" type="fk" />
                  <Th name="역할" type="text[]" />
                  <Th name="전화번호" type="varchar" />
                  <Th name="이메일" type="varchar" />
                  <th />
                </tr>
              </thead>
              <tbody>
                {emp.items.map((u, i) => (
                  <tr key={u.id} className={u.active ? '' : 'inactive'}>
                    <td className="rn">{i + 1}</td>
                    <td>
                      <strong>{u.loginId}</strong>
                      {!u.active && <span className="badge tone-absent">사용중지</span>}
                    </td>
                    <td>{u.name}</td>
                    <td>{u.affiliationName || '-'}</td>
                    <td>{u.roles.join(', ') || '-'}</td>
                    <td className="nowrap">{u.phone || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td className="right nowrap">
                      <button
                        className="btn ghost small"
                        disabled={u.isSuperAdmin || emp.resetId !== null}
                        title="비밀번호를 아이디와 같게 바꿉니다"
                        onClick={() => {
                          if (window.confirm(`${u.name}(${u.loginId})의 비밀번호를 아이디와 같게(${u.loginId}) 초기화할까요?`)) void emp.resetPassword(u.id)
                        }}
                      >
                        {emp.resetId === u.id ? '초기화 중…' : '비밀번호 초기화'}
                      </button>{' '}
                      <button className="btn primary small" disabled={!u.active || u.isSuperAdmin || emp.busyId !== null} onClick={() => emp.loginAs(u.id)}>
                        {emp.busyId === u.id ? '들어가는 중…' : '이 아이디로 로그인'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <GridFoot count={emp.items.length} note={`사용중 ${emp.items.filter((u) => u.active).length}`} />
        </>
      )}
    </section>
  )
}

type S = ReturnType<typeof useSettings>
type Report = (res: { ok: boolean; error?: string }, okText: string) => boolean

/* ── 역할부여: 아이디별 역할 추가/제거 + 소속 ── */
function AssignTab({ s, report }: { s: S; report: Report }) {
  const { me } = useSession()
  const [editId, setEditId] = useState<string | null>(null)
  const roles = s.data!.roles
  return (
    <section className="card">
      <p className="muted small">
        <strong>소속</strong>에 역할(예: A팀장)을 정하면, 그 역할을 가진 사람이 로그인했을 때 이 직원의 영상·통계·근태를 볼 수 있습니다. 위로 계속 이어집니다(팀원 → 팀장 → 관리자).
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <RowNoTh />
              <Th name="아이디" type="varchar" />
              <Th name="이름" type="text" />
              <Th name="역할" type="text[]" />
              <Th name="소속" type="fk" />
              <th />
            </tr>
          </thead>
          <tbody>
            {s.data!.users.map((u, i) => [
              <tr key={u.id} className={`${u.active ? '' : 'inactive'}${editId === u.id ? ' selected' : ''}`}>
                <td className="rn">{i + 1}</td>
                <td>
                  <strong>{u.loginId}</strong>
                  {!u.active && <span className="badge tone-absent">사용중지</span>}
                </td>
                <td>{u.name}</td>
                <td>
                  <RoleChips user={u} roles={roles} onChange={async (ids) => report(await s.setUserRoles(u.id, ids), `${u.name}님의 역할을 저장했습니다.`)} />
                </td>
                <td>
                  <select
                    value={u.affiliationRoleId || ''}
                    onChange={async (e) => report(await s.updateAccount(u.id, { affiliationRoleId: e.target.value || null }), `${u.name}님의 소속을 저장했습니다.`)}
                  >
                    <option value="">소속 없음</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="right">
                  <button className="btn ghost small" onClick={() => setEditId(editId === u.id ? null : u.id)}>
                    {editId === u.id ? '닫기' : '정보 수정'}
                  </button>
                </td>
              </tr>,
              editId === u.id && (
                <tr key={`${u.id}-edit`} className="detail-row">
                  <td colSpan={6}>
                    <AccountEditor user={u} isMe={u.id === me.id} s={s} report={report} />
                  </td>
                </tr>
              )
            ])}
          </tbody>
        </table>
      </div>
      <GridFoot count={s.data!.users.length} />
    </section>
  )
}

function RoleChips({ user, roles, onChange }: { user: SettingsUser; roles: SettingsRole[]; onChange: (ids: string[]) => void }) {
  const owned = roles.filter((r) => user.roleIds.includes(r.id))
  const rest = roles.filter((r) => !user.roleIds.includes(r.id))
  return (
    <div className="chips">
      {owned.length === 0 && <span className="muted small">역할 없음</span>}
      {owned.map((r) => (
        <span key={r.id} className="chip role">
          {r.name}
          <button aria-label={`${r.name} 역할 제거`} onClick={() => onChange(user.roleIds.filter((id) => id !== r.id))}>
            ×
          </button>
        </span>
      ))}
      {rest.length > 0 && (
        <select className="chip-add" value="" onChange={(e) => e.target.value && onChange([...user.roleIds, e.target.value])} aria-label="역할 추가">
          <option value="">+ 역할 추가</option>
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
    <form className="row-form" onSubmit={save}>
      <label className="field">
        <span>이름</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="field">
        <span>이메일</span>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label className="field">
        <span>전화번호</span>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </label>
      <label className="field">
        <span>새 비밀번호(바꿀 때만)</span>
        <input type="password" value={form.password} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      <button className="btn primary" disabled={busy}>
        <Ico>✓</Ico> 저장
      </button>
      {!isMe && (
        <button
          type="button"
          className={`btn ${user.active ? 'danger' : 'ghost'}`}
          onClick={async () => {
            if (user.active && !window.confirm(`${user.name}님 계정을 사용 중지할까요? 로그인할 수 없게 됩니다.`)) return
            report(await s.updateAccount(user.id, { active: !user.active }), user.active ? '사용 중지했습니다.' : '다시 사용하도록 했습니다.')
          }}
        >
          {user.active ? '사용 중지' : '사용 재개'}
        </button>
      )}
    </form>
  )
}

/* ── 역할설정: 역할 추가/이름변경/삭제 + 볼 수 있는 메뉴 체크박스 ── */
function RolesTab({ s, report }: { s: S; report: Report }) {
  const [name, setName] = useState('')
  const drag = useDragReorder(s.data!.roles, async (ids) => report(await s.reorderRoles(ids), '역할 순서를 저장했습니다.'))
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const toggle = async (role: SettingsRole, key: MenuKey) => {
    const next = role.menus.includes(key) ? role.menus.filter((k) => k !== key) : [...role.menus, key]
    report(await s.saveRoleMenus(role.id, next), `'${role.name}' 메뉴 권한을 저장했습니다.`)
  }

  return (
    <>
      <section className="card">
        <h2>역할 추가</h2>
        <form
          className="row-form"
          onSubmit={async (e) => {
            e.preventDefault()
            if (report(await s.createRole(name.trim()), `'${name.trim()}' 역할을 만들었습니다.`)) setName('')
          }}
        >
          <label className="field grow">
            <span>역할 이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) A팀장" maxLength={30} />
          </label>
          <button className="btn primary" disabled={!name.trim()}>
            <Ico>+</Ico> 추가
          </button>
        </form>
      </section>

      <section className="card">
        <h2>역할별로 볼 수 있는 메뉴</h2>
        <p className="muted small">체크한 메뉴만 보입니다. 여러 역할을 가진 사람은 모든 역할의 메뉴를 합쳐서 봅니다. 왼쪽 ⠿ 부분을 마우스로 끌어 놓으면 역할 순서가 바뀌고 바로 저장됩니다.</p>
        <div className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th className="drag-col" aria-label="순서" />
                <Th name="역할" type="text" />
                {MENUS.map((m) => (
                  <th key={m.key} className="center" title={m.description}>
                    <span className="th-name">{m.label}</span>
                    <span className="ty">bool</span>
                  </th>
                ))}
                <Th name="보유 / 소속" type="int" className="num" />
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
                      <span className="inline-edit">
                        <input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={30} autoFocus />
                        <button
                          className="btn primary small"
                          onClick={async () => {
                            if (report(await s.renameRole(r.id, renaming.name.trim()), '역할 이름을 바꿨습니다.')) setRenaming(null)
                          }}
                        >
                          저장
                        </button>
                        <button className="btn ghost small" onClick={() => setRenaming(null)}>
                          취소
                        </button>
                      </span>
                    ) : (
                      <>
                        <strong>{r.name}</strong>
                        {r.locked && <span className="muted small"> (항상 전체)</span>}
                      </>
                    )}
                  </td>
                  {MENUS.map((m) => (
                    <td key={m.key} className="center" style={m.key === 'settings' ? { whiteSpace: 'nowrap' } : undefined}>
                      <input type="checkbox" checked={r.menus.includes(m.key)} disabled={r.locked} onChange={() => toggle(r, m.key)} aria-label={`${r.name} - ${m.label}`} />
                      {m.key === 'settings' && <RoleSettingsDetail role={r} onSave={(id, tabs) => s.saveRoleSettingsTabs(id, tabs)} />}
                    </td>
                  ))}
                  <td className="num">
                    {r.holderCount} / {r.memberCount}
                  </td>
                  <td className="right nowrap">
                    {!r.locked && (
                      <button className="btn ghost small" onClick={() => setRenaming({ id: r.id, name: r.name })}>
                        이름 변경
                      </button>
                    )}
                    {!r.system && (
                      <button
                        className="btn ghost small danger-text"
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
        <GridFoot count={drag.items.length} />
        <p className="muted small">보유 =이 역할을 가진 사람 수, 소속 = 이 역할 밑에 소속된 직원 수</p>
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
    <section className="card">
      <h2>아이디 만들기</h2>
      <p className="muted small">여기서 만든 아이디와 비밀번호로 바로 로그인할 수 있습니다. 새 아이디는 기본으로 &lsquo;직원&rsquo; 역할을 받습니다.</p>
      <form
        className="grid-form"
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
        <label className="field">
          <span>아이디 (ID) *</span>
          <input value={form.loginId} onChange={(e) => set('loginId', e.target.value)} autoComplete="off" placeholder="영문/숫자" />
        </label>
        <label className="field">
          <span>비밀번호 (PW) *</span>
          <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" placeholder="4자 이상" />
        </label>
        <label className="field">
          <span>이름 *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>이메일 (선택)</span>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="field">
          <span>전화번호</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
        </label>
        <label className="field">
          <span>소속</span>
          <select value={form.affiliationRoleId || ''} onChange={(e) => setForm((f) => ({ ...f, affiliationRoleId: e.target.value || null }))}>
            <option value="">소속 없음</option>
            {s.data!.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            <Ico>+</Ico> {busy ? '만드는 중…' : '아이디 생성'}
          </button>
        </div>
      </form>
    </section>
  )
}
