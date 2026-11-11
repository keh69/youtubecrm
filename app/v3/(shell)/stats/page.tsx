'use client'

import { useMemo, useState } from 'react'
import { STAT_PRESETS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'

type Sort = 'date' | 'views' | 'duration'

const SORTS = [
  ['date', '최신순'],
  ['views', '조회수순'],
  ['duration', '길이순']
] as const

export default function V3Stats() {
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
  const labelEvery = daily.length <= 31 ? 1 : Math.ceil(daily.length / 15)
  const showOwner = st.who !== 'me' && st.who !== me.id

  return (
    <>
      <PageHead kicker="숫자로 보는 지면" title="통계">
        업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다).
      </PageHead>

      <section className="j-filters">
        {st.canPickPeople && (
          <label className="j-field">
            <span>누구</span>
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
        <div className="j-field">
          <span>기간</span>
          <div className="j-linkset" role="group" aria-label="기간 선택">
            {STAT_PRESETS.map((p) => (
              <button key={p.key} type="button" className={st.activePreset === p.key ? 'on' : ''} aria-pressed={st.activePreset === p.key} onClick={() => st.applyPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="j-field">
          <span>시작</span>
          <input type="date" value={st.from} onChange={(e) => e.target.value && st.setRange(e.target.value, st.to)} />
        </label>
        <label className="j-field">
          <span>끝</span>
          <input type="date" value={st.to} onChange={(e) => e.target.value && st.setRange(st.from, e.target.value)} />
        </label>
        {st.loading && st.data && <span className="j-refreshing">새로 불러오는 중…</span>}
      </section>

      {st.error && <Note msg={{ tone: 'error', text: st.error }} />}

      <hr className="j-double" />

      <section className="j-kpis">
        <div className="j-kpi">
          <span className="j-label">올린 영상</span>
          <strong>
            {fmtNumber(st.data?.summary.videoCount)}
            <small>개</small>
          </strong>
        </div>
        <div className="j-kpi">
          <span className="j-label">총 조회수</span>
          <strong>{fmtNumber(st.data?.summary.totalViews)}</strong>
        </div>
        <div className="j-kpi">
          <span className="j-label">총 재생시간(영상 길이 합)</span>
          <strong>{fmtTotalDuration(st.data?.summary.totalDurationSeconds || 0)}</strong>
        </div>
      </section>

      <hr className="j-double" />

      <section className="j-section">
        <h2 className="j-h2">일자별 올린 개수</h2>
        {st.loading && !st.data ? (
          <Loading />
        ) : (
          <div className="j-chart-wrap">
            <div className="j-chart" role="img" aria-label="일자별 업로드 개수 막대" style={{ minWidth: `${daily.length * 10}px` }}>
              {daily.map((d, i) => (
                <div key={d.date} className="j-col" title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}>
                  <span className="j-col-val">{d.count > 0 ? d.count : ''}</span>
                  <div className="j-col-track">
                    <div className="j-col-bar" style={{ height: `${(d.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="j-col-label">{i % labelEvery === 0 ? Number(d.date.slice(8)) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {st.data && st.data.perPerson.length > 0 && (
        <>
          <hr className="j-double" />
          <section className="j-section">
            <h2 className="j-h2">직원별</h2>
            <div className="j-table-wrap">
              <table className="j-table">
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
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td className="num">{fmtNumber(p.videoCount)}</td>
                      <td className="num">{fmtNumber(p.totalViews)}</td>
                      <td className="num nowrap">{fmtTotalDuration(p.totalDurationSeconds)}</td>
                      <td className="right nowrap">
                        <button type="button" className="j-textbtn" onClick={() => st.setWho(p.userId === me.id ? 'me' : p.userId)}>
                          영상 보기 →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <hr className="j-double" />

      <section className="j-section">
        <div className="j-section-head">
          <h2 className="j-h2">영상 ({fmtNumber(videos.length)})</h2>
          <div className="j-linkset" role="group" aria-label="정렬">
            {SORTS.map(([k, label]) => (
              <button key={k} type="button" className={sort === k ? 'on' : ''} aria-pressed={sort === k} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {st.loading && !st.data ? (
          <Loading />
        ) : videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <ul className="j-stories">
            {videos.map((v) => (
              <li key={v.id} className="j-story">
                <a href={v.url} target="_blank" rel="noreferrer" className="j-thumb">
                  <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  <span className="j-dur">{fmtDuration(v.durationSeconds)}</span>
                </a>
                <div className="j-story-body">
                  <a href={v.url} target="_blank" rel="noreferrer" className="j-story-title">
                    {v.title}
                  </a>
                  <p className="j-byline">
                    <span className="j-tag">{v.stockName}</span>
                    {showOwner && v.ownerName ? <span className="j-owner">글 · {v.ownerName}</span> : null}
                  </p>
                  <dl className="j-meta">
                    <div>
                      <dt>조회수</dt>
                      <dd>{fmtNumber(v.viewCount)}</dd>
                    </div>
                    <div>
                      <dt>재생시간</dt>
                      <dd>{fmtDuration(v.durationSeconds)}</dd>
                    </div>
                    <div>
                      <dt>올린 날짜</dt>
                      <dd>{fmtDate(v.publishedAt || v.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
