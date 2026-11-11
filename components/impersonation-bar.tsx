'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getImpersonation, getMeCached, getToken, returnToAdmin, type ImpersonationInfo } from '@/lib/crm/client/api'
import { skinBase } from '@/lib/crm/skins'
import { firstAllowedPath } from '@/lib/crm/menus'

// 사원 아이디로 들어가 있을 때 화면 오른쪽 위에 뜨는 "관리자로 복귀" 버튼 (모든 스킨 공통)
export function ImpersonationBar() {
  const pathname = usePathname()
  const [info, setInfo] = useState<ImpersonationInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => setInfo((await getToken()) ? getImpersonation() : null))()
  }, [pathname])

  if (!info) return null

  const back = async () => {
    setBusy(true)
    const err = await returnToAdmin()
    if (err) {
      setError(err)
      setBusy(false)
      window.location.assign('/login')
      return
    }
    const res = await getMeCached<{ menus: string[]; skin: string }>(true)
    window.location.assign(res.ok ? firstAllowedPath(skinBase(res.data.skin), res.data.menus) : '/login')
  }

  return (
    <div className="imp-bar" role="status">
      <span>
        <strong>{info.targetName}</strong>({info.targetLoginId}) 아이디로 보는 중
      </span>
      <button type="button" onClick={back} disabled={busy}>
        {busy ? '복귀 중…' : '관리자로 복귀'}
      </button>
      {error && <span className="imp-err">{error}</span>}
    </div>
  )
}
