'use client'

import { useMyContact } from '@/lib/crm/client/hooks'
import { cx, useSkinUi } from '@/lib/crm/client/skin-ui'

// 내정보 > 연락처 수정(모든 스킨 공통): 내 전화번호(숫자만)·이메일 고치기
export function MyContactForm() {
  const ui = useSkinUi() // 이 스킨의 버튼·입력칸·표·카드 모양
  const c = useMyContact()
  return (
    <form className={cx(ui.section, 'xs-panel')} onSubmit={c.submit}>
      <h2 className={cx(ui.h2, 'xs-h')}>연락처 수정</h2>
      <div className="xs-bar">
        <label className="xs-field">
          <span>전화번호 (숫자만)</span>
          <input className={cx(ui.input, 'xs-input')} value={c.phone} onChange={(e) => c.setPhone(e.target.value)} placeholder="01012345678" maxLength={11} inputMode="numeric" autoComplete="tel" disabled={c.loading} />
        </label>
        <label className="xs-field" style={{ flex: '1 1 240px' }}>
          <span>이메일</span>
          <input className={cx(ui.input, 'xs-input')} type="email" value={c.email} onChange={(e) => c.setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" disabled={c.loading} />
        </label>
        <button className={ui.btnPrimary} disabled={c.busy || c.loading} style={{ alignSelf: 'flex-end' }}>
          {c.busy ? '저장 중…' : '저장'}
        </button>
      </div>
      {c.error && (
        <p className="xs-err" role="alert">
          {c.error}
        </p>
      )}
      {c.done && (
        <p className="xs-ok" role="status">
          전화번호와 이메일을 저장했습니다.
        </p>
      )}
    </form>
  )
}
