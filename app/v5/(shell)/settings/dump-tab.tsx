'use client'

import { useMemo, useState } from 'react'
import { useDump, type DumpAttendance, type DumpVideo } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtHourMin, fmtNumber, fmtTimeSec, fmtYmdShort, statusLabel } from '@/lib/crm/client/format'
import { Empty, Loading, Note, type Msg } from '../../_components/ui'

const SHOW_MAX = 300 // 화면에는 최근 기록만, 전체는 CSV 로 내려받는다

// CSV 파일 만들기(엑셀에서 한글이 깨지지 않게 BOM 을 붙인다)
function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => {
    const t = String(v ?? '')
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const text = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const today = () => new Date().toISOString().slice(0, 10)

// 설정 → 06 덤프파일: 삭제된 사원의 근태 기록·영상 기록을 보관하는 곳.
// 영상은 한 편씩 또는 전체를 골라 사용 중인 사원에게 담당자를 넘길 수 있다(넘기면 덤프파일에서 빠진다).
export function DumpTab() {
  const dump = useDump()
  const [who, setWho] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [owner, setOwner] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const d = dump.data
  const att = useMemo(() => (d?.attendance || []).filter((r) => !who || r.userId === who), [d, who])
  const vids = useMemo(() => (d?.videos || []).filter((v) => !who || v.ownerId === who), [d, who])
  const allPicked = vids.length > 0 && vids.every((v) => picked.has(v.id))

  if (dump.loading) return <Loading />
  if (dump.error) return <Note msg={{ tone: 'error', text: dump.error }} role="alert" />
  if (!d) return null

  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(vids.map((v) => v.id)))

  const reassign = async () => {
    const ids = vids.filter((v) => picked.has(v.id)).map((v) => v.id)
    if (!ids.length || !owner) return
    const name = d.assignees.find((a) => a.id === owner)?.name || ''
    if (!window.confirm(`고른 영상 ${ids.length}개의 담당자를 ${name}님으로 바꿀까요?`)) return
    setBusy(true)
    const res = await dump.reassign(ids, owner)
    setBusy(false)
    setMsg(res.ok ? { tone: 'ok', text: res.text || '담당자를 바꿨습니다.' } : { tone: 'error', text: res.error || '바꾸지 못했습니다.' })
    if (res.ok) setPicked(new Set())
  }

  const csvAttendance = () =>
    downloadCsv(
      `근태기록_${today()}.csv`,
      ['이름', '날짜', '출근', '퇴근', '근무시간(분)', '상태', '결근사유'],
      att.map((r: DumpAttendance) => [r.name, r.workDate, fmtTimeSec(r.checkInAt), fmtTimeSec(r.checkOutAt), r.workedMinutes, statusLabel(r), r.absenceReason || ''])
    )
  const csvVideos = () =>
    downloadCsv(
      `영상기록_${today()}.csv`,
      ['담당자', '종목명', '제목', '주소', '업로드일', '조회수', '길이(초)'],
      vids.map((v: DumpVideo) => [v.ownerName, v.stockName, v.title, v.url, fmtDate(v.publishedAt || v.createdAt), v.viewCount, v.durationSeconds ?? ''])
    )

  return (
    <>
      <section className="g-glass">
        <h2 className="g-h2">덤프파일</h2>
        <p className="g-muted g-small">
          삭제된 사원의 근태 기록과 영상 기록이 여기에 보관됩니다. 이름은 &lsquo;홍길동(전)&rsquo;으로 보입니다. 영상은 골라서 다른 사원에게 담당자를 넘길 수 있고, CSV 파일로 내려받을 수 있습니다.
        </p>
        {d.people.length === 0 ? (
          <Empty>삭제된 사원이 없습니다.</Empty>
        ) : (
          <div className="g-dump-bar">
            <label className="g-field g-dump-who">
              <span>사원</span>
              <select className="g-input" value={who} onChange={(e) => (setWho(e.target.value), setPicked(new Set()))}>
                <option value="">삭제된 사원 전체 ({d.people.length}명)</option>
                {d.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.loginId} · 삭제 {fmtDate(p.deletedAt)}
                  </option>
                ))}
              </select>
            </label>
            <span className="g-chip">근태 {fmtNumber(att.length)}건</span>
            <span className="g-chip">영상 {fmtNumber(vids.length)}개</span>
          </div>
        )}
      </section>

      {d.people.length > 0 && (
        <>
          <Note msg={msg} />
          <section className="g-glass">
            <div className="g-dump-head">
              <h2 className="g-h2">영상기록</h2>
              <button className="g-btn ghost sm" disabled={!vids.length} onClick={csvVideos}>
                ⬇ CSV 내려받기
              </button>
            </div>
            {vids.length === 0 ? (
              <Empty>보관된 영상이 없습니다.</Empty>
            ) : (
              <>
                <div className="g-dump-reassign">
                  <span className="g-small">
                    <b>{vids.filter((v) => picked.has(v.id)).length}</b>개 선택
                  </span>
                  <select className="g-input sm" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="새 담당자">
                    <option value="">새 담당자 고르기</option>
                    {d.assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.loginId})
                      </option>
                    ))}
                  </select>
                  <button className="g-btn primary sm" disabled={busy || !owner || !vids.some((v) => picked.has(v.id))} onClick={reassign}>
                    {busy ? '바꾸는 중…' : '담당자 변경'}
                  </button>
                </div>
                <div className="g-table-wrap">
                  <table className="g-table">
                    <thead>
                      <tr>
                        <th className="center">
                          <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="영상 전체 선택" />
                        </th>
                        <th>담당자</th>
                        <th>종목명</th>
                        <th>제목</th>
                        <th>업로드일</th>
                        <th className="num">조회수</th>
                        <th className="num">길이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vids.slice(0, SHOW_MAX).map((v) => (
                        <tr key={v.id}>
                          <td className="center">
                            <input type="checkbox" checked={picked.has(v.id)} onChange={() => togglePick(v.id)} aria-label={`${v.title} 선택`} />
                          </td>
                          <td className="nowrap">{v.ownerName}</td>
                          <td className="nowrap">{v.stockName}</td>
                          <td>
                            <a href={v.url} target="_blank" rel="noreferrer">
                              {v.title}
                            </a>
                          </td>
                          <td className="nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                          <td className="num">{fmtNumber(v.viewCount)}</td>
                          <td className="num">{fmtDuration(v.durationSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {vids.length > SHOW_MAX && <p className="g-muted g-small">최근 {SHOW_MAX}개만 보입니다. 전체 선택은 {fmtNumber(vids.length)}개 모두를 고릅니다. 전체 기록은 CSV로 내려받으세요.</p>}
              </>
            )}
          </section>

          <section className="g-glass">
            <div className="g-dump-head">
              <h2 className="g-h2">근태기록</h2>
              <button className="g-btn ghost sm" disabled={!att.length} onClick={csvAttendance}>
                ⬇ CSV 내려받기
              </button>
            </div>
            {att.length === 0 ? (
              <Empty>보관된 근태 기록이 없습니다.</Empty>
            ) : (
              <>
                <div className="g-table-wrap">
                  <table className="g-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>날짜</th>
                        <th>출근</th>
                        <th>퇴근</th>
                        <th className="num">근무시간</th>
                        <th>상태</th>
                        <th>결근 사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {att.slice(0, SHOW_MAX).map((r) => (
                        <tr key={`${r.userId}-${r.workDate}`}>
                          <td className="nowrap">{r.name}</td>
                          <td className="nowrap">{fmtYmdShort(r.workDate)}</td>
                          <td className="nowrap">{fmtTimeSec(r.checkInAt)}</td>
                          <td className="nowrap">{fmtTimeSec(r.checkOutAt)}</td>
                          <td className="num">{r.checkInAt ? fmtHourMin(r.workedMinutes) : '-'}</td>
                          <td className="nowrap">{statusLabel(r)}</td>
                          <td>{r.absenceReason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {att.length > SHOW_MAX && <p className="g-muted g-small">최근 {SHOW_MAX}건만 보입니다. 전체 기록은 CSV로 내려받으세요.</p>}
              </>
            )}
          </section>
        </>
      )}
    </>
  )
}
