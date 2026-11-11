'use client'

import { useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
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
      <button type="button" className={`rsd-btn${open ? ' on' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} title={`${role.name}: 상세설정`}>
        상세설정
      </button>
      {open && (
        <span className="rsd-pop" role="dialog" aria-label={`${role.name} 상세설정`}>
          <span className="rsd-title">{role.name} · 상세설정</span>
          {settingsOn && SETTINGS_SUBS.map((s) => (
            <label key={s.key} className="rsd-row">
              <span>
                <b>{s.no}</b> {s.label}
              </span>
              <input type="checkbox" checked={role.locked || tabs.includes(s.key)} disabled={role.locked} onChange={() => toggle(s.key)} aria-label={`${role.name} - 설정 ${s.no} ${s.label}`} />
            </label>
          ))}
          {settingsOn && <span className="rsd-note">{role.locked ? '총 관리자는 설정 01~05가 항상 전부 보입니다.' : '끄면 이 역할의 설정 화면에서 그 메뉴가 사라집니다.'}</span>}
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
        </span>
      )}
    </span>
  )
}
