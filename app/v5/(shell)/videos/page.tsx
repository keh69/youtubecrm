'use client'

import { useState } from 'react'
import { useMenuGuard, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber } from '@/lib/crm/client/format'
import { Empty, Loading, PageHead } from '../../_components/ui'

export default function V5Videos() {
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
      <PageHead emoji="🎬" title="영상등록" desc="유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다." />

      <section className="g-glass g-register">
        <form className="g-row-form" onSubmit={reg.submit}>
          <label className="g-field">
            <span>종목명</span>
            <input className="g-input" value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <label className="g-field grow">
            <span>유튜브 영상 주소</span>
            <input className="g-input" value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="g-btn primary" disabled={reg.busy}>
            {reg.busy ? '추가 중…' : '＋ 추가'}
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
                <span className="g-chip accent">{added.video.stockName}</span>
                <span className="g-chip">조회수 {fmtNumber(added.video.viewCount)}</span>
                <span className="g-chip">{fmtDuration(added.video.durationSeconds)}</span>
                <span className="g-chip">업로드 {fmtDate(added.video.publishedAt)}</span>
              </div>
            </div>
            <button type="button" className="g-x" aria-label="닫기" onClick={reg.clearLastAdded}>
              ×
            </button>
          </div>
        )}
      </section>

      <section className="g-glass">
        <h2 className="g-h2">내가 최근 등록한 영상</h2>
        {listMsg && <p className="g-msg ok">{listMsg}</p>}
        {reg.recentLoading ? (
          <Loading />
        ) : reg.recent.length === 0 ? (
          <Empty>아직 등록한 영상이 없습니다.</Empty>
        ) : (
          <ul className="g-vlist">
            {reg.recent.map((v) => (
              <li key={v.id}>
                <a href={v.url} target="_blank" rel="noreferrer" className="g-thumb">
                  <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  <span className="g-dur">{fmtDuration(v.durationSeconds)}</span>
                </a>
                <div className="g-vlist-body">
                  <a href={v.url} target="_blank" rel="noreferrer" className="g-vtitle">
                    {v.title}
                  </a>
                  {editing?.id === v.id ? (
                    <div className="g-inline-edit">
                      <input
                        className="g-input sm"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveEdit()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        maxLength={60}
                        autoFocus
                        aria-label="종목명"
                      />
                      <button className="g-btn primary sm" onClick={saveEdit}>
                        저장
                      </button>
                      <button className="g-btn ghost sm" onClick={() => setEditing(null)}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="g-meta-chips">
                      <span className="g-chip accent">{v.stockName}</span>
                      <span className="g-chip">조회수 {fmtNumber(v.viewCount)}</span>
                      <span className="g-chip">업로드 {fmtDate(v.publishedAt)}</span>
                    </div>
                  )}
                </div>
                <div className="g-vlist-actions">
                  <button className="g-btn ghost sm" onClick={() => setEditing({ id: v.id, name: v.stockName })}>
                    종목명 수정
                  </button>
                  <button className="g-btn soft-danger sm" onClick={() => remove(v.id, v.title)}>
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
