'use client'

import { useMenuGuard } from '@/lib/crm/client/hooks'
import { DbInputView } from '@/components/db-input-view'

// 디비입력(v11): 화면 본문은 components/db-input-view.tsx (모든 스킨 공용)
export default function V11DbInput() {
  const allowed = useMenuGuard('db_input')
  if (!allowed) return null
  return (
    <>
      <div className="page-head">
        <h1>디비입력</h1>
        <p className="warn-banner">
          <span className="warn-ico" aria-hidden="true">
            ⚠
          </span>
          <span>직원마다 하루에 나온 DB 개수를 날짜 칸을 눌러 직접 적습니다. 적은 숫자는 영상통계·통계비교의 DB 지표에 바로 잡힙니다.</span>
        </p>
      </div>
      <DbInputView />
    </>
  )
}
