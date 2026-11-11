'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useVersionLinks } from '@/lib/crm/client/hooks'
import { getMeCached, getToken } from '@/lib/crm/client/api'

// 스킨(v1~v11) 바로가기. 최고관리자(총 관리자)에게만 보인다. (사이트 버전은 모든 화면 아래 꼬리말에 표시)
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
      {links.map((l) => (
        <Link key={l.key} href={l.href} title={l.name} aria-current={l.active ? 'page' : undefined}>
          {l.key}
        </Link>
      ))}
    </nav>
  )
}
