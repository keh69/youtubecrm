'use client'

import { useState } from 'react'
import { useMenuGuard, useSession, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, type Msg } from '../../_components/ui'
import { VideoTypePicker } from '@/components/video-type-picker'
import { VideoTable } from '@/components/video-table'

export default function V3Videos() {
  const allowed = useMenuGuard('videos')
  const { me } = useSession()
  const reg = useVideoRegister({ requireType: true })
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [listMsg, setListMsg] = useState<Msg>(null)
  if (!allowed) return null

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" 영상을 CRM에서 삭제할까요? (유튜브 영상은 그대로입니다)`)) return
    const res = await reg.remove(id)
    setListMsg(res.ok ? { tone: 'ok', text: '삭제했습니다.' } : { tone: 'error', text: res.error || '삭제 실패' })
  }

  const saveEdit = async () => {
    if (!editing) return
    const res = await reg.rename(editing.id, editing.name.trim())
    if (res.ok) setEditing(null)
    setListMsg(res.ok ? { tone: 'ok', text: '종목명을 고쳤습니다.' } : { tone: 'error', text: res.error || '수정 실패' })
  }

  const added = reg.lastAdded

  return (
    <>
      <PageHead kicker="기고란" title="영상등록">
        유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다.
      </PageHead>

      <section className="j-section">
        <form className="j-form-row" onSubmit={reg.submit}>
          <div className="j-field">
            <span>등록자</span>
            <div className="j-readonly" title="로그인한 사람 이름이 자동으로 붙습니다">
              {me.name} <small>(자동)</small>
            </div>
          </div>
          <label className="j-field">
            <span>종목명</span>
            <input value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <VideoTypePicker value={reg.contentType} onChange={reg.setContentType} warn={reg.error.includes('롱폼')} />
          <label className="j-field grow">
            <span>유튜브 영상 주소</span>
            <input value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="j-btn ink" disabled={reg.busy} style={{ marginLeft: 'auto' }}>
            {reg.busy ? '등록 중…' : '영상등록'}
          </button>
        </form>
        {reg.error && <Note msg={{ tone: 'error', text: reg.error }} alert />}

        {added && (
          <article className="j-added">
            <div className="j-added-head">
              <span className="j-kicker">{added.updated ? '정정 보도' : '방금 실린 영상'}</span>
              <button type="button" className="j-textbtn" onClick={reg.clearLastAdded}>
                닫기
              </button>
            </div>
            <Note msg={{ tone: 'ok', text: added.updated ? '이미 등록한 영상이라 정보를 새로 고쳤습니다.' : '등록했습니다.' }} />
            <div className="j-story">
              <a href={added.video.url} target="_blank" rel="noreferrer" className="j-thumb">
                <img src={added.video.thumbnailUrl} alt="" />
                <span className="j-dur">{fmtDuration(added.video.durationSeconds)}</span>
              </a>
              <div className="j-story-body">
                <a href={added.video.url} target="_blank" rel="noreferrer" className="j-story-title">
                  {added.video.title}
                </a>
                <p className="j-byline">
                  <span className="j-format">{videoFormatLabel(added.video)}</span>
                  <span className="j-tag">{added.video.stockName}</span> 조회수 {fmtNumber(added.video.viewCount)} · {fmtDuration(added.video.durationSeconds)} · 업로드{' '}
                  {fmtDate(added.video.publishedAt)} · 등록자 {added.video.ownerName || me.name}
                </p>
              </div>
            </div>
          </article>
        )}
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <h2 className="j-h2">내가 등록한 영상</h2>
        <Note msg={listMsg} />
        {reg.recentLoading ? (
          <p className="xs-muted">불러오는 중…</p>
        ) : (
          <VideoTable videos={reg.recent} canEdit={Boolean(me.canEditVideos)} onChanged={reg.reloadRecent} cls={{wrap: 'j-table-wrap', table: 'j-table j-vtable', vcell: 'j-vcell', thumb: 'j-thumb', vtitle: 'j-story-title', format: 'j-format', chip: 'j-tag', btn: 'j-textbtn', btnPrimary: 'j-btn ink small', btnDanger: 'j-textbtn danger', input: 'xs-input sm'}} emptyText="아직 등록한 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
