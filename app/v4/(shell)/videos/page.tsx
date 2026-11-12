'use client'

import { useState } from 'react'
import { useMenuGuard, useSession, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead } from '../../_components/ui'
import { VideoTypePicker } from '@/components/video-type-picker'
import { VideoTable } from '@/components/video-table'
import { ReservationSection } from '@/components/reservation-section'

export default function V4Videos() {
  const allowed = useMenuGuard('videos')
  const { me } = useSession()
  const reg = useVideoRegister({ requireType: true })
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [listMsg, setListMsg] = useState('')
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null) // 예약 표 [완료] → 영상리스트에서 이 영상으로
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
          <div className="field">
            <span>등록자</span>
            <div className="readonly-box" title="로그인한 사람 이름이 자동으로 붙습니다">
              {me.name} <small>(자동)</small>
            </div>
          </div>
          <label className="field">
            <span>종목명</span>
            <input value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <VideoTypePicker value={reg.contentType} onChange={reg.setContentType} warn={reg.error.includes('롱폼')} />
          <label className="field grow">
            <span>유튜브 영상 주소</span>
            <input value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="btn pink lg" disabled={reg.busy} style={{ marginLeft: 'auto' }}>
            {reg.busy ? '등록 중…' : '영상등록'}
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
              <span>
                등록자 <span className="owner">{added.video.ownerName || me.name}</span>
              </span>
            </div>
          </div>
          <button className="added-close" aria-label="닫기" onClick={reg.clearLastAdded}>
            ×
          </button>
        </section>
      )}

      {/* 예약등록: 유튜브 예약 링크를 넣어 두면 공개된 뒤 자동으로 아래 '영상리스트'에 들어간다 */}
      <ReservationSection onMoved={reg.reloadRecent} listed={reg.recent} onShow={(id) => setFocus({ id, n: Date.now() })} />

      <section className="blk">
        <BlockTitle color="pink">영상리스트 ({reg.recent.length})</BlockTitle>
        {listMsg && <Msg tone="ok">{listMsg}</Msg>}
        {reg.recentLoading ? (
          <p className="xs-muted">불러오는 중…</p>
        ) : (
          <VideoTable videos={reg.recent} focus={focus} canEdit={Boolean(me.canEditVideos)} onChanged={reg.reloadRecent} cls={{wrap: 'tbl-wrap', table: 'tbl vtbl', vcell: 'xs-vcell', thumb: 'vrow-thumb', vtitle: 'vtitle', format: 'xs-chip', chip: 'chip', btn: 'btn white sm', btnPrimary: 'btn mint sm', btnDanger: 'btn red sm', input: 'xs-input sm'}} emptyText="아직 등록한 영상이 없습니다." />
        )}
      </section>
    </>
  )
}

function FormatTag({ video }: { video: { durationSeconds: number | null; contentType?: string } }) {
  const label = videoFormatLabel(video)
  return <span className={`fmt-tag ${label === '롱폼' ? 'f-long' : 'f-short'}`}>{label}</span>
}
