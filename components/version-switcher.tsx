'use client'

import Link from 'next/link'
import { useVersionLinks } from '@/lib/crm/client/hooks'
import { VersionBadge } from '@/components/version-badge'

// 같은 화면을 다른 디자인 버전으로 바로 비교해 보는 작은 전환기 + 빌드 버전 표시.
export function VersionSwitcher({ buildVersion }: { buildVersion: string }) {
  const links = useVersionLinks()
  return (
    <nav className="vswitch" aria-label="디자인 버전 전환">
      <VersionBadge version={buildVersion} className="vswitch-build" />
      {links.map((l) => (
        <Link key={l.key} href={l.href} aria-current={l.active ? 'page' : undefined}>
          {l.key}
        </Link>
      ))}
    </nav>
  )
}
