'use client'

import { useState } from 'react'
import { useMenuGuard, useVideoRegister } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, videoFormatLabel } from '@/lib/crm/client/format'
import { GridFoot, Ico, RowNoTh, Th } from '../../_ui'

export default function V9Videos() {
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

  return (
    <>
      <div className="page-head">
        <h1>영상등록</h1>
        <p className="muted">유튜브에 올린 뒤 종목명과 영상 주소만 넣고 추가하세요. 제목·썸네일·조회수·길이·업로드 날짜는 자동으로 가져옵니다.</p>
      </div>

      <section className="card">
        <h2>새 행 추가 · INSERT</h2>
        <form className="row-form" onSubmit={reg.submit}>
          <label className="field">
            <span>
              종목명 <span className="ty">text</span>
            </span>
            <input value={reg.stockName} onChange={(e) => reg.setStockName(e.target.value)} placeholder="예) 삼성전자" maxLength={60} />
          </label>
          <label className="field grow">
            <span>
              유튜브 영상 주소 <span className="ty">url</span>
            </span>
            <input value={reg.url} onChange={(e) => reg.setUrl(e.target.value)} placeholder="https://youtu.be/..." inputMode="url" />
          </label>
          <button className="btn primary" disabled={reg.busy}>
            <Ico>+</Ico> {reg.busy ? '추가 중…' : '추가'}
          </button>
        </form>
        {reg.error && (
          <p className="msg error" role="alert">
            {reg.error}
          </p>
        )}
        {reg.lastAdded && (
          <div className="added">
            <img src={reg.lastAdded.video.thumbnailUrl} alt="" />
            <div>
              <p className="msg ok">{reg.lastAdded.updated ? '이미 등록한 영상이라 정보를 새로 고쳤습니다.' : '등록했습니다.'}</p>
              <strong>{reg.lastAdded.video.title}</strong>
              <p className="muted small">
                <span className="chip format">{videoFormatLabel(reg.lastAdded.video)}</span> {reg.lastAdded.video.stockName} · 조회수{' '}
                <span className="mono">{fmtNumber(reg.lastAdded.video.viewCount)}</span> · <span className="mono">{fmtDuration(reg.lastAdded.video.durationSeconds)}</span> · 업로드{' '}
                <span className="mono">{fmtDate(reg.lastAdded.video.publishedAt)}</span>
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>내가 최근 등록한 영상</h2>
        {listMsg && <p className="msg ok">{listMsg}</p>}
        {reg.recentLoading ? (
          <p className="muted">불러오는 중…</p>
        ) : reg.recent.length === 0 ? (
          <p className="empty">아직 등록한 영상이 없습니다.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table vtable">
                <thead>
                  <tr>
                    <RowNoTh />
                    <Th name="영상" type="text" />
                    <Th name="종목" type="text" />
                    <Th name="형식" type="enum" />
                    <Th name="조회수" type="int" className="num" />
                    <Th name="재생시간" type="interval" className="num" />
                    <Th name="올린 날짜" type="date" />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reg.recent.map((v, i) => (
                    <tr key={v.id}>
                      <td className="rn">{i + 1}</td>
                      <td>
                        <div className="vcell">
                          <a href={v.url} target="_blank" rel="noreferrer" className="thumb">
                            <img src={v.thumbnailUrl} alt="" loading="lazy" />
                          </a>
                          <a href={v.url} target="_blank" rel="noreferrer" className="video-title">
                            {v.title}
                          </a>
                        </div>
                      </td>
                      <td className="nowrap">
                        {editing?.id === v.id ? (
                          <span className="inline-edit">
                            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} autoFocus />
                            <button className="btn primary small" onClick={saveEdit}>
                              <Ico>✓</Ico> 저장
                            </button>
                            <button className="btn ghost small" onClick={() => setEditing(null)}>
                              취소
                            </button>
                          </span>
                        ) : (
                          <span className="chip">{v.stockName}</span>
                        )}
                      </td>
                      <td className="nowrap">
                        <span className="chip format">{videoFormatLabel(v)}</span>
                      </td>
                      <td className="num">{fmtNumber(v.viewCount)}</td>
                      <td className="num">{fmtDuration(v.durationSeconds)}</td>
                      <td className="mono nowrap">{fmtDate(v.publishedAt)}</td>
                      <td className="right nowrap">
                        <button className="btn ghost small" onClick={() => setEditing({ id: v.id, name: v.stockName })}>
                          <Ico>✎</Ico> 종목명 수정
                        </button>
                        <button className="btn ghost small danger-text" onClick={() => remove(v.id, v.title)}>
                          <Ico>✕</Ico> 삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <GridFoot count={reg.recent.length} />
          </>
        )}
      </section>
    </>
  )
}
