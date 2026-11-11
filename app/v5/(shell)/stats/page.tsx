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

export default function V5Stats() {
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
  const labelStep = Math.max(1, Math.ceil(daily.length / 15))
  const dense = daily.length > 31
  const showOwner = st.who !== 'me' && st.who !== me.id

  return (
    <>
      <PageHead emoji="📊" title="통계" desc="업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다)." />

      <section className="g-glass g-filters">
        {st.canPickPeople && (
          <label className="g-field">
            <span>누구</span>
            <select className="g-input" value={st.who} onChange={(e) => st.setWho(e.target.value)}>
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
        <div className="g-field">
          <span>기간</span>
          <div className="g-seg" role="group" aria-label="기간 빠른 선택">
            {STAT_PRESETS.map((p) => (
              <button key={p.key} type="button" className={st.activePreset === p.key ? 'on' : ''} aria-pressed={st.activePreset === p.key} onClick={() => st.applyPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="g-field">
          <span>직접 선택</span>
          <div className="g-range">
            <input className="g-input" type="date" aria-label="시작" value={st.from} onChange={(e) => e.target.value && st.setRange(e.target.value, st.to)} />
            <span className="g-muted">~</span>
            <input className="g-input" type="date" aria-label="끝" value={st.to} onChange={(e) => e.target.value && st.setRange(st.from, e.target.value)} />
          </div>
        </div>
        {st.loading && st.data && <span className="g-spinner g-filters-spin" aria-label="새로 불러오는 중" />}
      </section>

      {st.error && <Note msg={{ tone: 'error', text: st.error }} role="alert" />}

      <section className="g-kpis">
        <div className="g-kpi k1">
          <span className="g-kpi-icon" aria-hidden="true">
            🎞️
          </span>
          <small>올린 영상</small>
          <strong>{fmtNumber(st.data?.summary.videoCount)}개</strong>
        </div>
        <div className="g-kpi k2">
          <span className="g-kpi-icon" aria-hidden="true">
            👀
          </span>
          <small>총 조회수</small>
          <strong>{fmtNumber(st.data?.summary.totalViews)}</strong>
        </div>
        <div className="g-kpi k3">
          <span className="g-kpi-icon" aria-hidden="true">
            ⏱️
          </span>
          <small>총 재생시간(영상 길이 합)</small>
          <strong>{fmtTotalDuration(st.data?.summary.totalDurationSeconds || 0)}</strong>
        </div>
      </section>

      <section className="g-glass">
        <h2 className="g-h2">일자별 올린 개수</h2>
        {st.loading && !st.data ? (
          <Loading />
        ) : (
          <div className="g-chart-wrap">
            <div className={`g-chart ${dense ? 'dense' : ''}`} role="img" aria-label="일자별 업로드 개수 막대">
              {daily.map((d, i) => (
                <div key={d.date} className="g-col" title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}>
                  <span className="g-col-val">{d.count > 0 && !dense ? d.count : ''}</span>
                  <div className="g-col-track">
                    <div className={`g-col-bar ${d.count > 0 ? '' : 'zero'}`} style={{ height: d.count > 0 ? `${(d.count / maxCount) * 100}%` : undefined }} />
                  </div>
                  <span className="g-col-label">{i % labelStep === 0 || i === daily.length - 1 ? Number(d.date.slice(8)) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {st.data && st.data.perPerson.length > 0 && (
        <section className="g-glass">
          <h2 className="g-h2">직원별</h2>
          <div className="g-table-wrap">
            <table className="g-table">
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
                      <span className="g-who">
                        <span className="g-avatar xs">{p.name.slice(0, 1)}</span>
                        {p.name}
                      </span>
                    </td>
                    <td className="num">{fmtNumber(p.videoCount)}</td>
                    <td className="num">{fmtNumber(p.totalViews)}</td>
                    <td className="num">{fmtTotalDuration(p.totalDurationSeconds)}</td>
                    <td className="right">
                      <button className="g-btn ghost sm" onClick={() => st.setWho(p.userId === me.id ? 'me' : p.userId)}>
                        영상 보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="g-glass">
        <div className="g-card-head">
          <h2 className="g-h2">영상 ({fmtNumber(videos.length)})</h2>
          <div className="g-seg" role="group" aria-label="정렬">
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
          <ul className="g-vgrid">
            {videos.map((v) => (
              <li key={v.id}>
                <a href={v.url} target="_blank" rel="noreferrer" className="g-thumb">
                  <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  <span className="g-dur">{fmtDuration(v.durationSeconds)}</span>
                </a>
                <div className="g-vcard-body">
                  <div className="g-meta-chips">
                    <span className="g-chip accent">{v.stockName}</span>
                    {showOwner && v.ownerName && <span className="g-chip">{v.ownerName}</span>}
                  </div>
                  <a href={v.url} target="_blank" rel="noreferrer" className="g-vtitle">
                    {v.title}
                  </a>
                  <dl className="g-vmeta">
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
