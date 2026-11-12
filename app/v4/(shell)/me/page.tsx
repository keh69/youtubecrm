'use client'

import { useChangePassword, useSession } from '@/lib/crm/client/hooks'
import { BlockTitle, Msg, PageHead } from '../../_components/ui'
import { MyContactForm } from '@/components/my-contact'

export default function V4Me() {
  const { me } = useSession()
  const pw = useChangePassword()
  return (
    <>
      <PageHead title="내정보" tag="나야 나!" desc="내 계정 정보를 확인하고 비밀번호를 바꿀 수 있습니다." />

      <section className="blk bg-yellow">
        <BlockTitle color="blue">계정</BlockTitle>
        <div className="meta-row">
          <span className="chip">아이디 {me.loginId}</span>
          <span className="chip">이름 {me.name}</span>
          <span className="chip">역할 {me.roles.map((r) => r.name).join(', ') || '역할 없음'}</span>
        </div>
      </section>

      {/* 연락처 수정: 내 전화번호(숫자만)·이메일 */}
      <MyContactForm />

      <section className="blk">
        <BlockTitle color="pink">비밀번호 변경</BlockTitle>
        <form className="row-form" onSubmit={pw.submit}>
          <label className="field">
            <span>새 비밀번호 (4자 이상)</span>
            <input type="password" value={pw.next} onChange={(e) => pw.setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>새 비밀번호 확인</span>
            <input type="password" value={pw.confirm} onChange={(e) => pw.setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="btn pink lg" disabled={pw.busy}>
            {pw.busy ? '바꾸는 중…' : '비밀번호 변경!'}
          </button>
        </form>
        {pw.error && (
          <Msg tone="error" live="alert">
            {pw.error}
          </Msg>
        )}
        {pw.done && (
          <Msg tone="ok" live="status">
            비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.
          </Msg>
        )}
      </section>
    </>
  )
}
