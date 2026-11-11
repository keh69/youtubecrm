'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SETTINGS_SUBS, type SettingsSubKey } from '@/lib/crm/menus'
import type { SettingsRole } from '@/lib/crm/client/types'
import type { ActionResult } from '@/lib/crm/client/hooks'

// 역할설정 표: '설정' 스위치 오른쪽 [상세설정] 버튼(모든 스킨 공통).
// - 설정이 켜진 역할: 설정 안의 01 사원목록 ~ 05 스킨을 이 역할에게 보일지 정한다.
// - onSaveAffiliation 을 넘기면(v5) '하부' 스위치도 나온다: 켜면 아이디 생성의 소속 목록에 이 역할의 아이디가 나온다.
//   이 경우 설정이 꺼진 역할에도 버튼이 보인다('하부'만 정할 수 있게).
export function RoleSettingsDetail({
  role,
  onSave,
  onSaveAffiliation
}: {
  role: SettingsRole
  onSave: (roleId: string, tabs: SettingsSubKey[]) => Promise<ActionResult>
  onSaveAffiliation?: (roleId: string, visible: boolean) => Promise<ActionResult>
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const box = useRef<HTMLSpanElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // 창은 표 밖(body)에 띄운다. 표 칸 안에 두면 표의 스크롤 영역에 잘려서 일부만 보였다.
  // [상세설정] 버튼 바로 아래(오른쪽 끝 맞춤)에 두고, 화면 밖으로 나가면 안쪽으로 당긴다.
  const place = () => {
    const b = btn.current?.getBoundingClientRect()
    if (!b) return
    const w = pop.current?.offsetWidth || 300
    const h = pop.current?.offsetHeight || 320
    let left = b.right - w
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    let top = b.bottom + 8
    if (top + h > window.innerHeight - 8) top = Math.max(8, b.top - h - 8) // 아래 공간이 모자라면 버튼 위로
    setPos({ top, left })
  }
  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role.settingsTabs, role.affiliationVisible])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || pop.current?.contains(t)) return
      setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const follow = () => place()
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', follow, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', follow)
      window.removeEventListener('scroll', follow, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const settingsOn = role.menus.includes('settings')
  if (!settingsOn && !onSaveAffiliation) return null
  const tabs = role.settingsTabs || []
  const affVisible = role.affiliationVisible !== false

  const toggleAff = async () => {
    if (!onSaveAffiliation) return
    setError('')
    const res = await onSaveAffiliation(role.id, !affVisible)
    if (!res.ok && res.error) setError(res.error)
  }

  const toggle = async (key: SettingsSubKey) => {
    const next = tabs.includes(key) ? tabs.filter((k) => k !== key) : [...tabs, key]
    setError('')
    const res = await onSave(role.id, next)
    if (!res.ok && res.error) setError(res.error)
  }

  return (
    <span className="rsd" ref={box}>
      <button ref={btn} type="button" className={`rsd-btn${open ? ' on' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} title={`${role.name}: 상세설정`}>
        상세설정
      </button>
      {open &&
        createPortal(
        <span ref={pop} className="rsd-pop rsd-floating" role="dialog" aria-label={`${role.name} 상세설정`} style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}>
          <span className="rsd-title">{role.name} · 상세설정</span>
          {settingsOn &&
            SETTINGS_SUBS.filter((s) => !s.parent).map((s) => {
              const on = role.locked || tabs.includes(s.key)
              const children = SETTINGS_SUBS.filter((c) => c.parent === s.key)
              return (
                <div key={s.key} className="rsd-row">
                  <label className="rsd-row-label">
                    <b>{s.no}</b> {s.label}
                  </label>
                  <span className="rsd-row-main">
                    {/* 세부 권한(예: 사원목록의 편집·삭제): 부모가 켜져 있을 때만 보인다. 총 관리자는 항상 전부 켜짐 */}
                    {children.length > 0 && on && (
                      <span className="rsd-subs">
                        {children.map((c) => (
                          <label key={c.key} className="rsd-sub">
                            <input
                              type="checkbox"
                              className="rsd-chk"
                              checked={role.locked || tabs.includes(c.key)}
                              disabled={role.locked}
                              onChange={() => toggle(c.key)}
                              aria-label={`${role.name} - 설정 ${s.no} ${s.label} ${c.label} 권한`}
                            />
                            {c.label}
                          </label>
                        ))}
                      </span>
                    )}
                    <input type="checkbox" checked={on} disabled={role.locked} onChange={() => toggle(s.key)} aria-label={`${role.name} - 설정 ${s.no} ${s.label}`} />
                  </span>
                </div>
              )
            })}
          {settingsOn && <span className="rsd-note">{role.locked ? '총 관리자는 설정 메뉴와 세부 권한(편집·삭제)이 항상 전부 켜져 있습니다.' : '끄면 이 역할의 설정 화면에서 그 메뉴가 사라집니다. 사원목록을 켜면 편집·삭제 권한을 따로 고를 수 있습니다.'}</span>}
          {onSaveAffiliation && (
            <>
              <label className="rsd-row rsd-row-sep">
                <span>
                  <b>하부</b> 소속 목록에 보이기
                </span>
                <input type="checkbox" checked={affVisible} onChange={toggleAff} aria-label={`${role.name} - 하부(아이디 생성 소속 목록에 보이기)`} />
              </label>
              <span className="rsd-note">켜면 아이디 생성의 &lsquo;소속&rsquo;에 이 역할의 아이디가 나오고, 끄면 나오지 않습니다.</span>
            </>
          )}
          {error && <span className="rsd-error">{error}</span>}
        </span>,
          document.body
        )}
    </span>
  )
}
