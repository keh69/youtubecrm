'use client'

import { useMemo, useState } from 'react'
import { STAT_PRESETS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, Panel } from '../../_components/ui'

type Sort = 'date' | 'views' | 'duration'

const SORTS = [
  ['date', '최신순'],
  ['views', '조회수순'],
  ['duration', '길이순']
] as const

export default function V2Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const [sort, setSort] = useState<Sort>('date')

  const videos = useMemo(() => {
    const list = [...(st.data?.videos || [])]
    if (sort === 'views') list.sort((a, b) => b.viewCount - a.viewCount)
    else if (sort === 'duration') list.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0))
    else list.sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt))
    return list
  }, [st.data, sort])

  if (!allowed) return null
  const daily = st.data?.daily || []
  const maxCount = Math.max(1, ...daily.map((d) => d.count))
  const showOwner = st.who !== 'me' && st.who !== me.id
  // 막대가 많으면 날짜 라벨을 듬성듬성 찍는다.
  const labelEvery = daily.length > 60 ? 7 : daily.length > 31 ? 3 : 1

  return (
    <>
      <PageHead code="STA-01" title="통계" desc="업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다)." />

      <section className="filterbar">
        {st.canPickPeople && (
          <label className="fld">
            <span className="lbl">누구</span>
            <select value={st.who} onChange={(e) => st.setWho(e.target.value)}>
              <option value="me">나 ({me.name})</option>
              <option value="all">전체 직원</option>
              {st.data?.people
                .filter((p) => p.id !== me.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.loginId}){p.affiliationName ? ` · ${p.affiliationName}` : ''}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="fld">
          <span className="lbl">기간</span>
          <div className="seg">
            {STAT_PRESETS.map((p) => (
              <button key={p.key} type="button" className={st.activePreset === p.key ? 'on' : ''} onClick={() => st.applyPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="fld">
          <span className="lbl">시작</span>
          <input type="date" className="mono" value={st.from} onChange={(e) => e.target.value && st.setRange(e.target.value, st.to)} />
        </label>
        <label className="fld">
          <span className="lbl">끝</span>
          <input type="date" className="mono" value={st.to} onChange={(e) => e.target.value && st.setRange(st.from, e.target.value)} />
        </label>
        {st.loading && st.data && <span className="sync mono">SYNC…</span>}
      </section>

      {st.error && <Note msg={{ tone: 'error', text: st.error }} />}

      <section className="kpis">
        <div className="kpi">
          <span className="sect">올린 영상</span>
          <strong className="mono">
            {fmtNumber(st.data?.summary.videoCount)}
            <small>개</small>
          </strong>
        </div>
        <div className="kpi">
          <span className="sect">총 조회수</span>
          <strong className="mono">{fmtNumber(st.data?.summary.totalViews)}</strong>
        </div>
        <div className="kpi">
          <span className="sect">총 재생시간(영상 길이 합)</span>
          <strong className="mono">{fmtTotalDuration(st.data?.summary.totalDurationSeconds || 0)}</strong>
        </div>
      </section>

      <Panel label="일자별 올린 개수" right={<span className="muted small mono">MAX {maxCount}</span>}>
        {st.loading && !st.data ? (
          <Loading />
        ) : (
          <div className="chart-scroll">
            <div className="chart" role="img" aria-label="일자별 업로드 개수 막대" style={{ minWidth: `${Math.max(daily.length * 12, 200)}px` }}>
              {daily.map((d, i) => (
                <div key={d.date} className="chart-col" title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}>
                  <span className="chart-val mono">{d.count > 0 ? d.count : ''}</span>
                  <div className="chart-track">
                    <div className={`chart-bar ${d.count === 0 ? 'zero' : ''}`} style={{ height: `${(d.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="chart-label mono">{i % labelEvery === 0 || i === daily.length - 1 ? Number(d.date.slice(8)) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {st.data && st.data.perPerson.length > 0 && (
        <Panel label="직원별">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>직원</th>
                  <th className="num">영상</th>
                  <th className="num">총 조회수</th>
                  <th className="num">총 재생시간</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {st.data.perPerson.map((p) => (
                  <tr key={p.userId}>
                    <td>{p.name}</td>
                    <td className="num">{fmtNumber(p.videoCount)}</td>
                    <td className="num">{fmtNumber(p.totalViews)}</td>
                    <td className="num">{fmtTotalDuration(p.totalDurationSeconds)}</td>
                    <td className="right">
                      <button className="key ghost sm" onClick={() => st.setWho(p.userId === me.id ? 'me' : p.userId)}>
                        영상 보기 ▸
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel
        label={
          <>
            영상 <span className="count mono">{fmtNumber(videos.length)}</span>
          </>
        }
        right={
          <div className="seg">
            {SORTS.map(([k, label]) => (
              <button key={k} type="button" className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        {st.loading && !st.data ? (
          <Loading />
        ) : videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl vids">
              <thead>
                <tr>
                  <th>영상</th>
                  <th>종목명</th>
                  {showOwner && <th>직원</th>}
                  <th className={`num ${sort === 'views' ? 'sorted' : ''}`}>조회수</th>
                  <th className={`num ${sort === 'duration' ? 'sorted' : ''}`}>재생시간</th>
                  <th className={sort === 'date' ? 'sorted' : ''}>올린 날짜</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="vcell">
                        <a href={v.url} target="_blank" rel="noreferrer" className="vthumb">
                          <img src={v.thumbnailUrl} alt="" loading="lazy" />
                        </a>
                        <a href={v.url} target="_blank" rel="noreferrer" className="vtitle">
                          {v.title}
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className="sym">{v.stockName}</span>
                    </td>
                    {showOwner && <td className="nowrap">{v.ownerName || '-'}</td>}
                    <td className="num">{fmtNumber(v.viewCount)}</td>
                    <td className="num">{fmtDuration(v.durationSeconds)}</td>
                    <td className="mono nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
