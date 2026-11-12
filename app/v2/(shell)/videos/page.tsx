'use client'

import { useState } from 'react'
import { useMenuGuard, useSession, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber } from '@/lib/crm/client/format'
import { Empty, FormatChip, Loading, Note, PageHead, Panel } from '../../_components/ui'
import { VideoTypePicker } from '@/components/video-type-picker'
import { VideoTable } from '@/components/video-table'

export default function V2Videos() {
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

  const added = reg.lastAdded

  return (
    <>
      <PageHead code="VID-01" title="영상등록" desc="유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다." />

      <Panel label="새 영상 입력" className="panel-cmd">
        <form className="cmd-form" onSubmit={reg.submit}>
          <div className="fld">
            <span className="lbl">등록자</span>
            <div className="readonly-box" title="로그인한 사람 이름이 자동으로 붙습니다">
              {me.name} <span className="ro-note">(자동)</span>
            </div>
          </div>
          <label className="fld">
            <span className="lbl">종목명</span>
            <input value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <VideoTypePicker value={reg.contentType} onChange={reg.setContentType} warn={reg.error.includes('롱폼')} />
          <label className="fld grow">
            <span className="lbl">유튜브 영상 주소</span>
            <input className="mono" value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="key accent" disabled={reg.busy} style={{ marginLeft: 'auto' }}>
            {reg.busy ? '등록 중…' : '영상등록'}
          </button>
        </form>
        {reg.error && (
          <p className="note bad" role="alert">
            {reg.error}
          </p>
        )}
        {added && (
          <div className="added">
            <a href={added.video.url} target="_blank" rel="noreferrer" className="added-thumb">
              <img src={added.video.thumbnailUrl} alt="" />
            </a>
            <div className="added-body">
              <Note msg={{ tone: 'ok', text: added.updated ? '이미 등록한 영상이라 정보를 새로 고쳤습니다.' : '등록했습니다.' }} />
              <strong className="added-title">{added.video.title}</strong>
              <dl className="kv">
                <div>
                  <dt>형식</dt>
                  <dd>
                    <FormatChip video={added.video} />
                  </dd>
                </div>
                <div>
                  <dt>종목</dt>
                  <dd>
                    <span className="sym">{added.video.stockName}</span>
                  </dd>
                </div>
                <div>
                  <dt>조회수</dt>
                  <dd className="mono">{fmtNumber(added.video.viewCount)}</dd>
                </div>
                <div>
                  <dt>길이</dt>
                  <dd className="mono">{fmtDuration(added.video.durationSeconds)}</dd>
                </div>
                <div>
                  <dt>업로드</dt>
                  <dd className="mono">{fmtDate(added.video.publishedAt)}</dd>
                </div>
                <div>
                  <dt>등록자</dt>
                  <dd>{added.video.ownerName || me.name}</dd>
                </div>
              </dl>
            </div>
            <button className="key ghost sm added-close" onClick={reg.clearLastAdded} aria-label="닫기">
              ×
            </button>
          </div>
        )}
      </Panel>

      <Panel label="내가 등록한 영상" right={!reg.recentLoading && <span className="count mono">{reg.recent.length}</span>}>
        {listMsg && <Note msg={{ tone: 'ok', text: listMsg }} />}
        {reg.recentLoading ? (
          <p className="xs-muted">불러오는 중…</p>
        ) : (
          <VideoTable videos={reg.recent} canEdit={Boolean(me.canEditVideos)} onChanged={reg.reloadRecent} cls={{wrap: 'tbl-wrap', table: 'tbl vids', vcell: 'vcell', thumb: 'vthumb', vtitle: 'vtitle', format: 'xs-chip', chip: 'sym', btn: 'key ghost sm', btnPrimary: 'key accent sm', btnDanger: 'key ghost sm danger-text', input: 'xs-input sm'}} emptyText="아직 등록한 영상이 없습니다." />
        )}
      </Panel>
    </>
  )
}
