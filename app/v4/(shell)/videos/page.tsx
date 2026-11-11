'use client'

import { useState } from 'react'
import { useMenuGuard, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead } from '../../_components/ui'

export default function V4Videos() {
  const allowed = useMenuGuard('videos')
  const reg = useVideoRegister()
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [listMsg, setListMsg] = useState('')
  if (!allowed) return null

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" 영상을 CRM에서 삭제할까요? (유튜브 영상은 그대로입니다)`)) return
    const res = await reg.remove(id)
    setListMsg(res.ok ? '삭제했습니다.' : res.error || '삭제 실패')
  }

  const saveEdit = async () => {
    if (!editing) return
    const res = await reg.rename(editing.id, editing.name.trim())
    if (res.ok) setEditing(null)
    setListMsg(res.ok ? '종목명을 고쳤습니다.' : res.error || '수정 실패')
  }

  const added = reg.lastAdded

  return (
    <>
      <PageHead
        title="영상등록"
        tag="업로드 완료!"
        desc="유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다."
      />

      <section className="blk bg-yellow">
        <BlockTitle color="blue">새 영상 추가</BlockTitle>
        <form className="row-form" onSubmit={reg.submit}>
          <label className="field">
            <span>종목명</span>
            <input value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <label className="field grow">
            <span>유튜브 영상 주소</span>
            <input value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="btn pink lg" disabled={reg.busy}>
            {reg.busy ? '추가 중…' : '+ 추가'}
          </button>
        </form>
        {reg.error && (
          <Msg tone="error" live="alert">
            {reg.error}
          </Msg>
        )}
      </section>

      {added && (
        <section className="blk bg-mint added">
          <a href={added.video.url} target="_blank" rel="noreferrer" className="added-thumb">
            <img src={added.video.thumbnailUrl} alt="" />
          </a>
          <div className="added-body">
            <span className="sticker tone-ok">{added.updated ? '이미 등록한 영상이라 정보를 새로 고쳤습니다.' : '등록했습니다.'}</span>
            <a href={added.video.url} target="_blank" rel="noreferrer" className="added-title">
              {added.video.title}
            </a>
            <div className="meta-row">
              <FormatTag video={added.video} />
              <span className="chip">{added.video.stockName}</span>
              <span>조회수 {fmtNumber(added.video.viewCount)}</span>
              <span>{fmtDuration(added.video.durationSeconds)}</span>
              <span>업로드 {fmtDate(added.video.publishedAt)}</span>
            </div>
          </div>
          <button className="added-close" aria-label="닫기" onClick={reg.clearLastAdded}>
            ×
          </button>
        </section>
      )}

      <section className="blk">
        <BlockTitle color="pink" right={!reg.recentLoading && reg.recent.length > 0 ? <span className="count-pill">{reg.recent.length}개</span> : undefined}>
          내가 최근 등록한 영상
        </BlockTitle>
        {listMsg && <Msg tone="ok">{listMsg}</Msg>}
        {reg.recentLoading ? (
          <Loading />
        ) : reg.recent.length === 0 ? (
          <Empty>아직 등록한 영상이 없습니다.</Empty>
        ) : (
          <ul className="vcards">
            {reg.recent.map((v) => (
              <li key={v.id} className="vcard">
                <a href={v.url} target="_blank" rel="noreferrer" className="vthumb">
                  <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  <span className="vdur">{fmtDuration(v.durationSeconds)}</span>
                </a>
                <div className="vbody">
                  <a href={v.url} target="_blank" rel="noreferrer" className="vtitle">
                    {v.title}
                  </a>
                  {editing?.id === v.id ? (
                    <div className="inline-edit">
                      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} autoFocus aria-label="종목명" />
                      <button className="btn mint sm" onClick={saveEdit}>
                        저장
                      </button>
                      <button className="btn white sm" onClick={() => setEditing(null)}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="meta-row">
                      <FormatTag video={v} />
                      <span className="chip">{v.stockName}</span>
                      <span>조회수 {fmtNumber(v.viewCount)}</span>
                      <span>업로드 {fmtDate(v.publishedAt)}</span>
                    </div>
                  )}
                </div>
                <div className="vactions">
                  <button className="btn white sm" onClick={() => setEditing({ id: v.id, name: v.stockName })}>
                    종목명 수정
                  </button>
                  <button className="btn red sm" onClick={() => remove(v.id, v.title)}>
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function FormatTag({ video }: { video: { durationSeconds: number | null; contentType?: string } }) {
  const label = videoFormatLabel(video)
  return <span className={`fmt-tag ${label === '롱폼' ? 'f-long' : 'f-short'}`}>{label}</span>
}
