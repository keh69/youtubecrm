'use client'

import { useEffect, useRef, useState } from 'react'
import { SETTINGS_SUBS, type SettingsSubKey } from '@/lib/crm/menus'
import type { SettingsRole } from '@/lib/crm/client/types'
import type { ActionResult } from '@/lib/crm/client/hooks'

// 역할설정 표: '설정'이 켜진 역할의 스위치 오른쪽 [상세] 버튼.
// 누르면 설정 안의 01 사원목록 ~ 04 아이디생성을 이 역할에게 보일지 정하는 작은 창이 열린다(모든 스킨 공통).
export function RoleSettingsDetail({
  role,
  onSave
}: {
  role: SettingsRole
  onSave: (roleId: string, tabs: SettingsSubKey[]) => Promise<ActionResult>
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

  if (!role.menus.includes('settings')) return null
  const tabs = role.settingsTabs || []

  const toggle = async (key: SettingsSubKey) => {
    const next = tabs.includes(key) ? tabs.filter((k) => k !== key) : [...tabs, key]
    setError('')
    const res = await onSave(role.id, next)
    if (!res.ok && res.error) setError(res.error)
  }

  return (
    <span className="rsd" ref={box}>
      <button type="button" className={`rsd-btn${open ? ' on' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} title={`${role.name}: 설정 안의 하부 메뉴(01~04) 보이기 설정`}>
        상세
      </button>
      {open && (
        <span className="rsd-pop" role="dialog" aria-label={`${role.name} 설정 하부 메뉴`}>
          <span className="rsd-title">{role.name} · 설정 하부 메뉴</span>
          {SETTINGS_SUBS.map((s) => (
            <label key={s.key} className="rsd-row">
              <span>
                <b>{s.no}</b> {s.label}
              </span>
              <input type="checkbox" checked={role.locked || tabs.includes(s.key)} disabled={role.locked} onChange={() => toggle(s.key)} aria-label={`${role.name} - 설정 ${s.no} ${s.label}`} />
            </label>
          ))}
          <span className="rsd-note">{role.locked ? '총 관리자는 항상 전부 보입니다.' : '끄면 이 역할의 설정 화면에서 그 메뉴가 사라집니다. 05 스킨은 항상 보입니다.'}</span>
          {error && <span className="rsd-error">{error}</span>}
        </span>
      )}
    </span>
  )
}
