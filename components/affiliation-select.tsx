'use client'

import type { SettingsData } from '@/lib/crm/client/types'

// 소속 선택칸(모든 스킨 공통): 역할별로 그 역할이 적용된 아이디만 보여 준다(적용된 아이디가 없는 역할은 안 보임).
// 고른 아이디(사람) 밑으로 소속된다. 자기 자신(excludeId)과 사용중지된 아이디는 나오지 않는다.
// listedOnly: 아이디 생성처럼 역할설정 > 상세설정 '하부'가 켜진 역할의 아이디만 보여 줄 때.
export function AffiliationSelect({
  data,
  value,
  legacyRoleId,
  excludeId,
  onChange,
  className,
  listedOnly = false
}: {
  data: SettingsData
  value: string | null
  legacyRoleId?: string | null
  excludeId?: string
  onChange: (userId: string | null) => void
  className?: string
  listedOnly?: boolean
}) {
  const { roles, users } = data
  const groups = roles
    .filter((r) => !listedOnly || r.affiliationVisible !== false)
    .map((r) => ({ role: r, people: users.filter((u) => u.active && u.id !== excludeId && u.roleIds.includes(r.id)) }))
    .filter((g) => g.people.length > 0)
  const legacy = !value && legacyRoleId ? roles.find((r) => r.id === legacyRoleId) : undefined
  // 소속된 사람이 목록에 없을 때(삭제됨 → '홍길동(전)', 사용중지 → '홍길동(사용중지)') 그대로 보여 준다(다시 고를 수는 없다)
  const stopped = value ? users.find((u) => u.id === value && !u.active) : undefined
  const deleted = value && !stopped ? (data.formerUsers || []).find((u) => u.id === value) : undefined
  const former = stopped ? `${stopped.name}(사용중지)` : deleted ? `${deleted.name}(전)` : ''
  return (
    <select className={className} value={value || (legacy ? 'legacy' : '')} onChange={(e) => e.target.value !== 'legacy' && onChange(e.target.value || null)} aria-label="소속">
      <option value="">소속 없음</option>
      {former && (
        <option value={value!} disabled>
          {former}
        </option>
      )}
      {legacy && (
        <option value="legacy" disabled>
          (예전 방식) 역할 &lsquo;{legacy.name}&rsquo; — 사람을 다시 골라 주세요
        </option>
      )}
      {groups.map((g) => (
        <optgroup key={g.role.id} label={g.role.name}>
          {g.people.map((u) => (
            <option key={`${g.role.id}-${u.id}`} value={u.id}>
              {u.name} ({u.loginId})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
