'use client'

import { useState } from 'react'
import { useMenuGuard, useSession, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { VideoTypePicker } from '@/components/video-type-picker'
import { VideoTable } from '@/components/video-table'

export default function V6Videos() {
  const allowed = useMenuGuard('videos')
  const { me } = useSession()
  const reg = useVideoRegister({ requireType: true })
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

  return (
    <>
      <div className="page-head">
        <h1>영상등록</h1>
        <p className="muted">유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다.</p>
      </div>

      <section className="card">
        <form className="row-form" onSubmit={reg.submit}>
          <div className="field">
            <span>등록자</span>
            <div className="readonly-box" title="로그인한 사람 이름이 자동으로 붙습니다">
              {me.name} <span className="ro-note">(자동)</span>
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
          <button className="btn primary" disabled={reg.busy} style={{ marginLeft: 'auto' }}>
            {reg.busy ? '등록 중…' : '영상등록'}
          </button>
        </form>
        {reg.error && <p className="msg error" role="alert">{reg.error}</p>}
        {reg.lastAdded && (
          <div className="added">
            <img src={reg.lastAdded.video.thumbnailUrl} alt="" />
            <div>
              <p className="msg ok">{reg.lastAdded.updated ? '이미 등록한 영상이라 정보를 새로 고쳤습니다.' : '등록했습니다.'}</p>
              <strong>{reg.lastAdded.video.title}</strong>
              <p className="muted small">
                <span className="chip format">{videoFormatLabel(reg.lastAdded.video)}</span> {reg.lastAdded.video.stockName} · 조회수 {fmtNumber(reg.lastAdded.video.viewCount)} · {fmtDuration(reg.lastAdded.video.durationSeconds)} · 업로드 {fmtDate(reg.lastAdded.video.publishedAt)} · 등록자 {reg.lastAdded.video.ownerName || me.name}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>내가 등록한 영상</h2>
        {listMsg && <p className="msg ok">{listMsg}</p>}
        {reg.recentLoading ? (
          <p className="xs-muted">불러오는 중…</p>
        ) : (
          <VideoTable videos={reg.recent} canEdit={Boolean(me.canEditVideos)} onChanged={reg.reloadRecent} cls={{wrap: 'table-wrap', table: 'table vtable', vcell: 'vcell', thumb: 'thumb', vtitle: 'video-title', format: 'xs-chip', chip: 'chip', btn: 'btn ghost small', btnPrimary: 'btn primary small', btnDanger: 'btn ghost small danger-text', input: 'xs-input sm'}} emptyText="아직 등록한 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
