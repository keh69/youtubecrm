'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useVersionLinks } from '@/lib/crm/client/hooks'
import { getMeCached, getToken } from '@/lib/crm/client/api'
import { VersionBadge } from '@/components/version-badge'

// 하단 빌드 버전 + 스킨(v1~v11) 바로가기. 최고관리자(총 관리자)에게만 보인다.
export function VersionSwitcher({ buildVersion }: { buildVersion: string }) {
  const links = useVersionLinks()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!(await getToken())) {
        if (alive) setVisible(false)
        return
      }
      const res = await getMeCached<{ isSuperAdmin: boolean }>()
      if (alive) setVisible(res.ok && res.data.isSuperAdmin)
    })()
    return () => {
      alive = false
    }
  }, [pathname])

  if (!visible) return null
  return (
    <nav className="vswitch" aria-label="스킨 전환 (최고관리자 전용)">
      <VersionBadge version={buildVersion} className="vswitch-build" />
      {links.map((l) => (
        <Link key={l.key} href={l.href} title={l.name} aria-current={l.active ? 'page' : undefined}>
          {l.key}
        </Link>
      ))}
    </nav>
  )
}
