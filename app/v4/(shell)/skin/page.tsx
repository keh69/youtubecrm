'use client'

import { useSkins } from '@/lib/crm/client/hooks'
import { BlockTitle, Msg, PageHead } from '../../_components/ui'

const CARD_BG = ['bg-yellow-soft', 'bg-pink-soft', 'bg-mint-soft', 'bg-blue-soft']

export default function V4Skin() {
  const sk = useSkins()
  return (
    <>
      <PageHead title="스킨" tag="골라 골라!" desc="화면 디자인을 고르세요. 적용하면 내 아이디에 저장되어 다음에 로그인해도 같은 스킨으로 열립니다. 기능은 모든 스킨이 같습니다." />
      {sk.error && (
        <Msg tone="error" live="alert">
          {sk.error}
        </Msg>
      )}
      <section className="blk">
        <BlockTitle color="pink">스킨 고르기</BlockTitle>
        <ul className="skin-grid">
          {sk.skins.map((s, i) => {
            const on = sk.current === s.key
            return (
              <li key={s.key} className={`skin-card ${on ? 'bg-yellow on' : CARD_BG[i % CARD_BG.length]}`}>
                <span className="chip">{s.key}</span>
                <strong className="skin-name">{s.name}</strong>
                <p>{s.description}</p>
                <button className={`btn ${on ? 'white' : 'blue'}`} disabled={on || sk.busy !== null} onClick={() => sk.apply(s.key)}>
                  {on ? '사용 중' : sk.busy === s.key ? '적용 중…' : '적용·저장!'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
