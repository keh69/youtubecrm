'use client'

import { useState } from 'react'
import { useMenuGuard, useSession, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { Loading, PageHead } from '../../_components/ui'
import { VideoTable } from '@/components/video-table'
import { ReservationSection } from './reservation-section'

export default function V5Videos() {
  const allowed = useMenuGuard('videos')
  const { me } = useSession()
  const reg = useVideoRegister({ requireType: true }) // 롱폼/숏폼을 꼭 골라야 추가된다
  if (!allowed) return null


  const added = reg.lastAdded
  const formatTag = (v: { durationSeconds: number | null; contentType?: string }) => {
    const label = videoFormatLabel(v)
    return <span className={`g-format ${label === '롱폼' ? 'long' : 'short'}`}>{label}</span>
  }

  return (
    <>
      <PageHead emoji="🎬" title="영상등록" desc="유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다." />

      <section className="g-glass g-register">
        <form className="g-row-form" onSubmit={reg.submit}>
          <div className="g-field">
            <span>등록자</span>
            <div className="g-readonly" title="로그인한 사람 이름이 자동으로 붙습니다">
              {me.name} <small>(자동)</small>
            </div>
          </div>
          <label className="g-field">
            <span>종목명</span>
            <input className="g-input" value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <div className="g-field">
            <span>형식 *</span>
            <div className={`g-seg g-type-pick${reg.error.includes('롱폼') ? ' warn' : ''}`} role="radiogroup" aria-label="롱폼 또는 숏폼">
              {(
                [
                  ['longform', '롱폼'],
                  ['shortform', '숏폼']
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={reg.contentType === k} className={reg.contentType === k ? 'on' : ''} onClick={() => reg.setContentType(k)}>
                  {reg.contentType === k ? '☑' : '☐'} {label}
                </button>
              ))}
            </div>
          </div>
          <label className="g-field grow">
            <span>유튜브 영상 주소</span>
            <input className="g-input" value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="g-btn primary g-register-btn" disabled={reg.busy}>
            {reg.busy ? '등록 중…' : '영상등록'}
          </button>
        </form>
        {reg.error && (
          <p className="g-msg error" role="alert">
            {reg.error}
          </p>
        )}
        {added && (
          <div className="g-added">
            <a href={added.video.url} target="_blank" rel="noreferrer" className="g-thumb">
              <img src={added.video.thumbnailUrl} alt="" />
              <span className="g-dur">{fmtDuration(added.video.durationSeconds)}</span>
            </a>
            <div className="g-added-body">
              <p className="g-msg ok">{added.updated ? '이미 등록한 영상이라 정보를 새로 고쳤습니다.' : '등록했습니다.'}</p>
              <strong className="g-added-title">{added.video.title}</strong>
              <div className="g-meta-chips">
                {formatTag(added.video)}
                <span className="g-chip accent">{added.video.stockName}</span>
                <span className="g-chip">조회수 {fmtNumber(added.video.viewCount)}</span>
                <span className="g-chip">재생시간 {fmtDuration(added.video.durationSeconds)}</span>
                <span className="g-chip">업로드 {fmtDate(added.video.publishedAt)}</span>
                <span className="g-chip">등록자 {added.video.ownerName || me.name}</span>
              </div>
            </div>
            <button type="button" className="g-x" aria-label="닫기" onClick={reg.clearLastAdded}>
              ×
            </button>
          </div>
        )}
      </section>

      {/* 예약등록: 유튜브 예약 링크를 넣어 두면 공개된 뒤 자동으로 아래 '내가 등록한 영상'에 들어간다 */}
      <ReservationSection onMoved={reg.reloadRecent} />

      {/* 내가 등록한 영상 표(영상통계와 같은 표). 영상등록 '수정권한'이면 줄마다 수정·삭제 */}
      <section className="g-glass">
        <h2 className="g-h2">내가 등록한 영상 ({reg.recent.length})</h2>
        {reg.recentLoading ? (
          <Loading />
        ) : (
          <VideoTable videos={reg.recent} canEdit={Boolean(me.canEditVideos)} onChanged={reg.reloadRecent} cls={{ wrap: 'g-table-wrap', table: 'g-table g-vtable', vcell: 'g-vcell', thumb: 'g-thumb', vtitle: 'g-vtitle', format: 'g-format', formatLong: 'long', formatShort: 'short', who: 'g-who', avatar: 'g-avatar xs', chip: 'g-chip accent', btn: 'g-btn ghost sm', btnPrimary: 'g-btn primary sm', btnDanger: 'g-btn soft-danger sm', input: 'g-input sm', empty: 'g-empty', msg: 'g-msg ok' }} emptyText="아직 등록한 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
