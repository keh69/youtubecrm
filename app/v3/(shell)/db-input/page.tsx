'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { DbInputView } from '@/components/db-input-view'
import { PageHead } from '../../_components/ui'

// 디비입력(v3): 화면 본문은 components/db-input-view.tsx (모든 스킨 공용)
export default function V3DbInput() {
  const allowed = useMenuGuard('db_input')
  if (!allowed) return null
  return (
    <>
      <PageHead kicker="DB 기록 장부" title="디비입력">
        직원마다 하루에 나온 DB 개수를 날짜 칸을 눌러 직접 적습니다.
      </PageHead>
      <DbInputView />
    </>
  )
}
