'use client'

import { useState } from 'react'
import { MENUS, type MenuKey } from '@/lib/crm/menus'
import { SkinPicker } from '@/components/skin-picker'
import { RoleSettingsDetail } from '@/components/role-settings-detail'
import { AffiliationSelect } from '@/components/affiliation-select'
import { EMPLOYEE_TABS_NOTE, EMPTY_ACCOUNT, useDragReorder, useSettingsTabs, useEmployees, useMenuGuard, useSession, useSettings, type SettingsTab } from '@/lib/crm/client/hooks'
import type { NewAccount, SettingsRole, SettingsUser } from '@/lib/crm/client/types'
import { CopyEmployeeFormButton } from '@/components/copy-employee-form'

type Tab = SettingsTab
type Msg = { tone: 'ok' | 'error'; text: string } | null

export default function V11Settings() {
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
        <p className="warn-banner">
          <span className="warn-ico" aria-hidden="true">
            ⚠
          </span>
          <span>역할을 만들고, 아이디마다 역할과 소속을 정하고, 역할별로 볼 수 있는 메뉴를 고릅니다. 바꾼 값은 바로 서버에 저장됩니다.</span>
        </p>
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
          <h2>스킨 선택</h2>
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
      <h2>내 하부 사원</h2>
      <div className="copy-form-bar">
        <p className="muted small">{EMPLOYEE_TABS_NOTE}</p>
        <CopyEmployeeFormButton />
      </div>
      {emp.error && <p className="msg error">{emp.error}</p>}
      {emp.notice && <p className="msg ok" role="status">{emp.notice}</p>}
      {emp.loading ? (
        <p className="muted">불러오는 중…</p>
      ) : emp.items.length === 0 ? (
        <p className="empty">내 소속 하부에 있는 사원이 없습니다. 02 역할부여에서 사원의 소속을 나(내 아이디)로 정해 주세요.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>아이디</th>
                  <th>이름</th>
                  <th>소속</th>
                  <th>역할</th>
                  <th>전화번호</th>
                  <th>이메일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {emp.items.map((u) => (
                  <tr key={u.id} className={u.active ? '' : 'inactive'}>
                    <td>
                      <strong>{u.loginId}</strong>
                      {!u.active && <span className="badge tone-absent">사용중지</span>}
                      <code className="flag-id inline"> #employee-{u.loginId}</code>
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
          <p className="muted small">{emp.items.length}명 · 사용중 {emp.items.filter((u) => u.active).length}명</p>
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
        <strong>소속</strong>에서 사람(아이디)을 고르면 그 사람 밑으로 들어가, 그 사람이 로그인했을 때 이 직원의 영상·통계·근태를 볼 수 있습니다. 위로 계속 이어집니다(팀원 → 팀장 → 관리자). 소속 목록에는 역할별로 그 역할이 적용된 아이디만 나옵니다.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>아이디</th>
              <th>이름</th>
              <th>역할</th>
              <th>소속</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.data!.users.map((u) => [
              <tr key={u.id} className={u.active ? '' : 'inactive'}>
                <td>
                  <strong>{u.loginId}</strong>
                  {!u.active && <span className="badge tone-absent">사용중지</span>}
                </td>
                <td>{u.name}</td>
                <td>
                  <RoleChips user={u} roles={roles} onChange={async (ids) => report(await s.setUserRoles(u.id, ids), `${u.name}님의 역할을 저장했습니다.`)} />
                </td>
                <td>
                  <AffiliationSelect
                    data={s.data!}
                    className="pill-select"
                    value={u.affiliationUserId}
                    legacyRoleId={u.affiliationRoleId}
                    excludeId={u.id}
                    onChange={async (id) => report(await s.updateAccount(u.id, { affiliationUserId: id }), `${u.name}님의 소속을 저장했습니다.`)}
                  />
                </td>
                <td className="right">
                  <button className="btn ghost small" onClick={() => setEditId(editId === u.id ? null : u.id)}>
                    {editId === u.id ? '닫기' : '정보 수정'}
                  </button>
                </td>
              </tr>,
              editId === u.id && (
                <tr key={`${u.id}-edit`} className="detail-row">
                  <td colSpan={5}>
                    <AccountEditor user={u} isMe={u.id === me.id} s={s} report={report} />
                  </td>
                </tr>
              )
            ])}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RoleChips({ user, roles, onChange }: { user: SettingsUser; roles: SettingsRole[]; onChange: (ids: string[]) => void }) {
  const owned = roles.filter((r) => user.roleIds.includes(r.id))
  const rest = roles.filter((r) => !user.roleIds.includes(r.id))
  // 역할은 아이디마다 1개만(역할이 없을 때만 추가 보임). 총 관리자는 추가·× 버튼을 숨긴다.
  const isSuper = owned.some((r) => r.locked)
  return (
    <div className="chips">
      {owned.length === 0 && <span className="muted small">역할 없음</span>}
      {owned.map((r) => (
        <span key={r.id} className="chip role">
          {r.name}
          {!isSuper && (
            <button aria-label={`${r.name} 역할 제거`} onClick={() => onChange(user.roleIds.filter((id) => id !== r.id))}>
              ×
            </button>
          )}
        </span>
      ))}
      {owned.length === 0 && rest.length > 0 && (
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
        저장
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
          className="flag-list"
          onSubmit={async (e) => {
            e.preventDefault()
            if (report(await s.createRole(name.trim()), `'${name.trim()}' 역할을 만들었습니다.`)) setName('')
          }}
        >
          <div className="flag">
            <label className="flag-body" htmlFor="v11-role-name">
              <span className="flag-title">역할 이름</span>
              <span className="flag-desc">만든 뒤 아래 표에서 볼 수 있는 메뉴를 고릅니다.</span>
              <code className="flag-id">#role-create</code>
            </label>
            <div className="flag-ctl grow">
              <input id="v11-role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예) A팀장" maxLength={30} />
              <button className="btn primary" disabled={!name.trim()}>
                추가
              </button>
            </div>
          </div>
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
                <th>역할</th>
                {MENUS.map((m) => (
                  <th key={m.key} className="center" title={m.description}>
                    {m.label}
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
                      {m.key === 'settings' && <RoleSettingsDetail role={r} onSave={(id, tabs) => s.saveRoleSettingsTabs(id, tabs)} onSaveAffiliation={(id, v) => s.saveRoleAffiliation(id, v)} />}
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
        <p className="muted small">보유 = 이 역할을 가진 사람 수, 소속 = 이 역할 밑에 소속된 직원 수</p>
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
      <p className="muted small">여기서 만든 아이디와 비밀번호로 바로 로그인할 수 있습니다. 새 아이디는 기본 역할(역할설정 표 맨 아래 역할, 예: 사원)을 받습니다.</p>
      <form
        className="flag-list"
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
        <label className="flag">
          <span className="flag-body">
            <span className="flag-title">아이디 (ID) *</span>
            <span className="flag-desc">로그인할 때 쓰는 아이디입니다.</span>
            <code className="flag-id">#account-login-id</code>
          </span>
          <span className="flag-ctl">
            <input value={form.loginId} onChange={(e) => set('loginId', e.target.value)} autoComplete="off" placeholder="영문/숫자" />
          </span>
        </label>
        <label className="flag">
          <span className="flag-body">
            <span className="flag-title">비밀번호 (PW) *</span>
            <code className="flag-id">#account-password</code>
          </span>
          <span className="flag-ctl">
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" placeholder="4자 이상" />
          </span>
        </label>
        <label className="flag">
          <span className="flag-body">
            <span className="flag-title">이름 *</span>
            <code className="flag-id">#account-name</code>
          </span>
          <span className="flag-ctl">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </span>
        </label>
        <label className="flag">
          <span className="flag-body">
            <span className="flag-title">이메일 (선택)</span>
            <code className="flag-id">#account-email</code>
          </span>
          <span className="flag-ctl">
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </span>
        </label>
        <label className="flag">
          <span className="flag-body">
            <span className="flag-title">전화번호</span>
            <code className="flag-id">#account-phone</code>
          </span>
          <span className="flag-ctl">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
          </span>
        </label>
        <label className="flag">
          <span className="flag-body">
            <span className="flag-title">소속</span>
            <span className="flag-desc">이 직원을 볼 수 있는 상위 역할입니다.</span>
            <code className="flag-id">#account-affiliation</code>
          </span>
          <span className="flag-ctl">
            <AffiliationSelect data={s.data!} listedOnly className="pill-select" value={form.affiliationUserId || null} onChange={(id) => setForm((f) => ({ ...f, affiliationUserId: id, affiliationRoleId: null }))} />
          </span>
        </label>
        <div className="flag">
          <div className="flag-body">
            <span className="flag-title">아이디 생성 실행</span>
            <code className="flag-id">#account-create</code>
          </div>
          <div className="flag-ctl">
            <button className="btn primary" disabled={busy}>
              {busy ? '만드는 중…' : '아이디 생성'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
