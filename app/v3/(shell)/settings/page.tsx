'use client'

import { Fragment, useState } from 'react'
import { MENUS, type MenuKey } from '@/lib/crm/menus'
import { EMPLOYEE_TABS_NOTE, EMPTY_ACCOUNT, useEmployees, useMenuGuard, useSession, useSettings, useSettingsTabs, useDragReorder, type SettingsTab } from '@/lib/crm/client/hooks'
import type { NewAccount, SettingsRole, SettingsUser } from '@/lib/crm/client/types'
import { SkinPicker } from '@/components/skin-picker'
import { Empty, Loading, Note, PageHead, type Msg } from '../../_components/ui'
import { CopyEmployeeFormButton } from '@/components/copy-employee-form'
import { RoleSettingsDetail } from '@/components/role-settings-detail'
import { AffiliationSelect } from '@/components/affiliation-select'
import { AttendanceEditToggle, DumpPanel, EmployeeManage, SignupRoleSelect, UnresolvedPanel, useSettingsTabFromUrl } from '@/components/settings-extra'
import { isoToDotted } from '@/components/date-input'

export default function V3Settings() {
  const allowed = useMenuGuard('settings')
  const s = useSettings()
  const st = useSettingsTabs({ dump: true, unresolved: true }) // 역할별로 허용된 설정 하부 메뉴만(05 스킨은 항상)
  const [tabState, setTab] = useState<SettingsTab | null>(null)
  useSettingsTabFromUrl(setTab) // 알림의 '처리하러 가기'나 ?tab= 으로 탭 열기
  const tab: SettingsTab = tabState && st.tabs.some((x) => x.key === tabState) ? tabState : st.first
  const [msg, setMsg] = useState<Msg>(null)
  if (!allowed) return null

  const report = (res: { ok: boolean; error?: string }, okText: string) => {
    setMsg(res.ok ? { tone: 'ok', text: okText } : { tone: 'error', text: res.error || '처리하지 못했습니다.' })
    return res.ok
  }

  return (
    <>
      <PageHead kicker="편집국 공지" title="설정">
        역할을 만들고, 아이디마다 역할과 소속을 정하고, 역할별로 볼 수 있는 메뉴를 고릅니다.
      </PageHead>

      {s.data && !s.data.migrated && (
        <Note
          msg={{
            tone: 'error',
            text: 'DB 업데이트가 필요합니다. supabase/sql/simple/200_simple_crm.sql 을 Supabase SQL Editor에서 실행해 주세요. (그 전에는 소속·역할부여·아이디생성이 저장되지 않습니다)'
          }}
        />
      )}

      <div className="j-tabs" role="tablist" aria-label="설정 항목">
        {st.tabs.map((t, i) => (
          <Fragment key={t.key}>
            {i > 0 && <span className="j-tab-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'on' : ''}
              onClick={() => {
                setTab(t.key)
                setMsg(null)
              }}
            >
              <span className="j-tab-no">{t.no}</span> {t.label}
            </button>
          </Fragment>
        ))}
      </div>
      <hr className="j-rule" />

      <Note msg={msg} />
      {s.error && <Note msg={{ tone: 'error', text: s.error }} />}
      {s.loading && !s.data && <Loading />}

      {tab === 'employees' && <EmployeesTab />}
      {s.data && tab === 'assign' && <AssignTab s={s} report={report} />}
      {s.data && tab === 'roles' && <RolesTab s={s} report={report} />}
      {s.data && tab === 'create' && <CreateTab s={s} report={report} onDone={() => setTab('assign')} />}
      {tab === 'dump' && <DumpPanel />}
      {tab === 'unresolved' && <UnresolvedPanel />}
      {st.tabs.length === 0 && <p className="xs-empty">설정 안에서 볼 수 있는 메뉴가 없습니다. 관리자에게 역할설정 &gt; 상세설정에서 켜 달라고 요청해 주세요.</p>}
      {tab === 'skin' && st.tabs.length > 0 && (
        <section className="j-section">
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
    <section className="j-section">
      <div className="copy-form-bar">
        <p className="j-aside">{EMPLOYEE_TABS_NOTE}</p>
        <CopyEmployeeFormButton />
      </div>
      {emp.error && <Note msg={{ tone: 'error', text: emp.error }} />}
      {emp.notice && <Note msg={{ tone: 'ok', text: emp.notice }} />}
      {emp.loading ? (
        <Loading />
      ) : emp.items.length === 0 ? (
        <Empty>내 소속 하부에 있는 사원이 없습니다. 02 역할부여에서 사원의 소속을 나(내 아이디)로 정해 주세요.</Empty>
      ) : (
        <div className="j-table-wrap">
          <table className="j-table">
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
                <tr key={u.id} className={u.active ? '' : 'j-inactive'}>
                  <td className="nowrap">
                    <strong>{u.loginId}</strong>
                    {!u.active && <span className="j-stamp tone-absent">사용중지</span>}
                  </td>
                  <td className="nowrap">{u.name}</td>
                  <td className="nowrap">{isoToDotted(u.hireDate) || '-'}</td>
                  <td>{u.affiliationName || '-'}</td>
                  <td>{u.roles.join(', ') || '-'}</td>
                  <td className="nowrap">{u.phone || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td className="right nowrap">
                    <button
                      type="button"
                      className="j-btn plain small"
                      disabled={u.isSuperAdmin || emp.resetId !== null}
                      title="비밀번호를 아이디와 같게 바꿉니다"
                      onClick={() => {
                        if (window.confirm(`${u.name}(${u.loginId})의 비밀번호를 아이디와 같게(${u.loginId}) 초기화할까요?`)) void emp.resetPassword(u.id)
                      }}
                    >
                      {emp.resetId === u.id ? '초기화 중…' : '비밀번호 초기화'}
                    </button>{' '}
                    <button type="button" className="j-btn ink small" disabled={!u.active || u.isSuperAdmin || emp.busyId !== null} onClick={() => emp.loginAs(u.id)}>
                      {emp.busyId === u.id ? '들어가는 중…' : '이 아이디로 로그인'}
                    </button>
                    <EmployeeManage user={u} emp={emp} btnClass="j-btn plain small" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

type S = ReturnType<typeof useSettings>
type Report = (res: { ok: boolean; error?: string }, okText: string) => boolean

/* ── 역할부여 ── */
function AssignTab({ s, report }: { s: S; report: Report }) {
  const { me } = useSession()
  const [editId, setEditId] = useState<string | null>(null)
  const roles = s.data!.roles
  return (
    <section className="j-section">
      <p className="j-aside">
        <strong>소속</strong>에서 사람(아이디)을 고르면 그 사람 밑으로 들어가, 그 사람이 로그인했을 때 이 직원의 영상·통계·근태를 볼 수 있습니다. 위로 계속 이어집니다(팀원 → 팀장 → 관리자). 소속 목록에는 역할별로 그 역할이 적용된 아이디만 나옵니다.
      </p>
      <div className="j-table-wrap">
        <table className="j-table">
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
            {s.data!.users.map((u) => (
              <Fragment key={u.id}>
                <tr className={u.active ? '' : 'j-inactive'}>
                  <td className="nowrap">
                    <strong>{u.loginId}</strong>
                    {!u.active && <span className="j-stamp tone-absent">사용중지</span>}
                  </td>
                  <td className="nowrap">{u.name}</td>
                  <td>
                    <RoleChips user={u} roles={roles} onChange={async (ids) => report(await s.setUserRoles(u.id, ids), `${u.name}님의 역할을 저장했습니다.`)} />
                  </td>
                  <td>
                    <AffiliationSelect
                      data={s.data!}
                      className="j-select-sm"
                      value={u.affiliationUserId}
                      legacyRoleId={u.affiliationRoleId}
                      excludeId={u.id}
                      onChange={async (id) => report(await s.updateAccount(u.id, { affiliationUserId: id }), `${u.name}님의 소속을 저장했습니다.`)}
                    />
                  </td>
                  <td className="right nowrap">
                    <button type="button" className="j-textbtn" aria-expanded={editId === u.id} onClick={() => setEditId(editId === u.id ? null : u.id)}>
                      {editId === u.id ? '닫기' : '정보 수정'}
                    </button>
                  </td>
                </tr>
                {editId === u.id && (
                  <tr className="j-detail">
                    <td colSpan={5}>
                      <AccountEditor user={u} isMe={u.id === me.id} s={s} report={report} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
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
    <div className="j-chips">
      {owned.length === 0 && <span className="j-muted small">역할 없음</span>}
      {owned.map((r) => (
        <span key={r.id} className="j-chip">
          {r.name}
          {!isSuper && (
            <button type="button" aria-label={`${r.name} 역할 제거`} onClick={() => onChange(user.roleIds.filter((id) => id !== r.id))}>
              ×
            </button>
          )}
        </span>
      ))}
      {owned.length === 0 && rest.length > 0 && (
        <select className="j-chip-add" value="" onChange={(e) => e.target.value && onChange([...user.roleIds, e.target.value])} aria-label="역할 추가">
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
    <form className="j-editor" onSubmit={save}>
      <span className="j-kicker">{user.loginId} 계정 정보</span>
      <div className="j-form-grid">
        <label className="j-field">
          <span>이름</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="j-field">
          <span>이메일</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="j-field">
          <span>전화번호</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="j-field">
          <span>새 비밀번호(바꿀 때만)</span>
          <input type="password" value={form.password} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
      </div>
      <div className="j-actions">
        <button className="j-btn ink" disabled={busy}>
          저장
        </button>
        {!isMe && (
          <button
            type="button"
            className={`j-btn ${user.active ? 'danger' : 'plain'}`}
            onClick={async () => {
              if (user.active && !window.confirm(`${user.name}님 계정을 사용 중지할까요? 로그인할 수 없게 됩니다.`)) return
              report(await s.updateAccount(user.id, { active: !user.active }), user.active ? '사용 중지했습니다.' : '다시 사용하도록 했습니다.')
            }}
          >
            {user.active ? '사용 중지' : '사용 재개'}
          </button>
        )}
      </div>
    </form>
  )
}

/* ── 역할설정 ── */
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
      <section className="j-section">
        <h2 className="j-h2">역할 추가</h2>
        <form
          className="j-form-row"
          onSubmit={async (e) => {
            e.preventDefault()
            if (report(await s.createRole(name.trim()), `'${name.trim()}' 역할을 만들었습니다.`)) setName('')
          }}
        >
          <label className="j-field grow">
            <span>역할 이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) A팀장" maxLength={30} />
          </label>
          <button className="j-btn ink" disabled={!name.trim()}>
            추가
          </button>
        </form>
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <h2 className="j-h2">상세설정</h2>
        <SignupRoleSelect s={s} report={report} />
        <p className="j-aside">체크한 메뉴만 보입니다. 여러 역할을 가진 사람은 모든 역할의 메뉴를 합쳐서 봅니다. 왼쪽 ⠿ 부분을 마우스로 끌어 놓으면 역할 순서가 바뀌고 바로 저장됩니다.</p>
        <div className="j-table-wrap">
          <table className="j-table matrix">
            <thead>
              <tr>
                <th className="drag-col" aria-label="순서" />
                <th>역할</th>
                {MENUS.map((m) => (
                  <th key={m.key} className="center" title={m.description}>
                    {m.key === 'attendance_team' ? '근태통계' : m.label}
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
                  <td className="nowrap">
                    {renaming?.id === r.id ? (
                      <span className="j-inline-edit">
                        <input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={30} autoFocus aria-label="역할 이름" />
                        <button
                          type="button"
                          className="j-btn ink small"
                          onClick={async () => {
                            if (report(await s.renameRole(r.id, renaming.name.trim()), '역할 이름을 바꿨습니다.')) setRenaming(null)
                          }}
                        >
                          저장
                        </button>
                        <button type="button" className="j-textbtn" onClick={() => setRenaming(null)}>
                          취소
                        </button>
                      </span>
                    ) : (
                      <>
                        <strong className="j-role-name">{r.name}</strong>
                        {r.locked && <small className="j-muted"> (항상 전체)</small>}
                      </>
                    )}
                  </td>
                  {MENUS.map((m) => (
                    <td key={m.key} className="center" style={m.key === 'settings' ? { whiteSpace: 'nowrap' } : undefined}>
                      <input
                        type="checkbox"
                        className="j-check"
                        checked={r.menus.includes(m.key)}
                        disabled={r.locked}
                        onChange={() => toggle(r, m.key)}
                        aria-label={`${r.name} - ${m.label}`}
                      />
                      {m.key === 'settings' && <RoleSettingsDetail role={r} onSave={(id, tabs) => s.saveRoleSettingsTabs(id, tabs)} onSaveAffiliation={(id, v) => s.saveRoleAffiliation(id, v)} />}
                      {m.key === 'attendance_team' && <AttendanceEditToggle role={r} s={s} report={report} />}
                    </td>
                  ))}
                  <td className="num">
                    {r.holderCount} / {r.memberCount}
                  </td>
                  <td className="right nowrap">
                    {!r.locked && (
                      <button type="button" className="j-textbtn" onClick={() => setRenaming({ id: r.id, name: r.name })}>
                        이름 변경
                      </button>
                    )}
                    {!r.system && r.signupRole && (
                      <button
                        type="button"
                        className="j-textbtn xs-signup-btn"
                        style={{ minWidth: 84 }}
                        title="회원가입·아이디 만들기에서 새 아이디가 받는 역할이라 삭제할 수 없습니다. 바꾸려면 위의 '회원가입 시 역할'에서 다른 역할을 고르세요."
                        onClick={() => document.querySelector<HTMLSelectElement>('.xs-signup-role select')?.focus()}
                      >
                        가입역할
                      </button>
                    )}
                    {!r.system && !r.signupRole && (
                      <button
                        type="button"
                        className="j-textbtn danger"
                        style={{ minWidth: 84 }}
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
        <p className="j-fine">보유 = 이 역할을 가진 사람 수, 소속 = 이 역할 밑에 소속된 직원 수</p>
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
    <section className="j-section">
      <h2 className="j-h2">아이디 만들기</h2>
      <p className="j-aside">여기서 만든 아이디와 비밀번호로 바로 로그인할 수 있습니다. 새 아이디는 기본으로 &lsquo;{s.data!.roles.find((r) => r.signupRole)?.name || '사원'}&rsquo; 역할을 받습니다.</p>
      <form
        className="j-form-grid"
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
        <label className="j-field">
          <span>아이디 (ID) *</span>
          <input value={form.loginId} onChange={(e) => set('loginId', e.target.value)} autoComplete="off" placeholder="영문/숫자" />
        </label>
        <label className="j-field">
          <span>비밀번호 (PW) *</span>
          <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" placeholder="4자 이상" />
        </label>
        <label className="j-field">
          <span>이름 *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="j-field">
          <span>이메일 (선택)</span>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="j-field">
          <span>전화번호</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
        </label>
        <label className="j-field">
          <span>소속</span>
          <AffiliationSelect data={s.data!} listedOnly value={form.affiliationUserId || null} onChange={(id) => setForm((f) => ({ ...f, affiliationUserId: id, affiliationRoleId: null }))} />
        </label>
        <div className="j-actions span">
          <button className="j-btn ink" disabled={busy}>
            {busy ? '만드는 중…' : '아이디 생성'}
          </button>
        </div>
      </form>
    </section>
  )
}
