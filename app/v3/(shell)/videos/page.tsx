'use client'

import { useState } from 'react'
import { useMenuGuard, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, type Msg } from '../../_components/ui'

export default function V3Videos() {
  const allowed = useMenuGuard('videos')
  const reg = useVideoRegister()
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
          <label className="j-field">
            <span>종목명</span>
            <input value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <label className="j-field grow">
            <span>유튜브 영상 주소</span>
            <input value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="j-btn ink" disabled={reg.busy}>
            {reg.busy ? '추가 중…' : '추가'}
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
                  <span className="j-tag">{added.video.stockName}</span> 조회수 {fmtNumber(added.video.viewCount)} · {fmtDuration(added.video.durationSeconds)} · 업로드{' '}
                  {fmtDate(added.video.publishedAt)}
                </p>
              </div>
            </div>
          </article>
        )}
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <h2 className="j-h2">내가 최근 등록한 영상</h2>
        <Note msg={listMsg} />
        {reg.recentLoading ? (
          <Loading />
        ) : reg.recent.length === 0 ? (
          <Empty>아직 등록한 영상이 없습니다.</Empty>
        ) : (
          <ul className="j-stories">
            {reg.recent.map((v) => (
              <li key={v.id} className="j-story">
                <a href={v.url} target="_blank" rel="noreferrer" className="j-thumb">
                  <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  <span className="j-dur">{fmtDuration(v.durationSeconds)}</span>
                </a>
                <div className="j-story-body">
                  <a href={v.url} target="_blank" rel="noreferrer" className="j-story-title">
                    {v.title}
                  </a>
                  {editing?.id === v.id ? (
                    <div className="j-inline-edit">
                      <input
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
                      <button type="button" className="j-btn ink small" onClick={saveEdit}>
                        저장
                      </button>
                      <button type="button" className="j-textbtn" onClick={() => setEditing(null)}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <p className="j-byline">
                      <span className="j-tag">{v.stockName}</span> 조회수 {fmtNumber(v.viewCount)} · 업로드 {fmtDate(v.publishedAt)}
                    </p>
                  )}
                  <div className="j-story-actions">
                    <button type="button" className="j-textbtn" onClick={() => setEditing({ id: v.id, name: v.stockName })}>
                      종목명 수정
                    </button>
                    <button type="button" className="j-textbtn danger" onClick={() => remove(v.id, v.title)}>
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
