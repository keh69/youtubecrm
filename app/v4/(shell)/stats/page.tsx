'use client'

import { useMemo, useState } from 'react'
import { STAT_PRESETS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead } from '../../_components/ui'

type Sort = 'date' | 'views' | 'duration'

const SORTS = [
  ['date', '최신순'],
  ['views', '조회수순'],
  ['duration', '길이순']
] as const

export default function V4Stats() {
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
  const maxCount = Math.max(1, ...(st.data?.daily.map((d) => d.count) || [0]))
  const showOwner = st.who !== 'me' && st.who !== me.id

  return (
    <>
      <PageHead title="통계" tag="숫자 쾅!" desc="업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다)." />

      <section className="blk filters">
        {st.canPickPeople && (
          <label className="field">
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
        <div className="field">
          <span>기간</span>
          <div className="seg">
            {STAT_PRESETS.map((p) => (
              <button key={p.key} type="button" className={st.activePreset === p.key ? 'on' : ''} aria-pressed={st.activePreset === p.key} onClick={() => st.applyPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>시작</span>
          <input type="date" value={st.from} onChange={(e) => e.target.value && st.setRange(e.target.value, st.to)} />
        </label>
        <label className="field">
          <span>끝</span>
          <input type="date" value={st.to} onChange={(e) => e.target.value && st.setRange(st.from, e.target.value)} />
        </label>
        {st.loading && st.data && <span className="refreshing">새로 고치는 중…</span>}
      </section>

      {st.error && <Msg tone="error">{st.error}</Msg>}

      <section className="kpis">
        <div className="blk kpi bg-yellow">
          <span>올린 영상</span>
          <strong>
            {fmtNumber(st.data?.summary.videoCount)}
            <small>개</small>
          </strong>
        </div>
        <div className="blk kpi bg-pink">
          <span>총 조회수</span>
          <strong>{fmtNumber(st.data?.summary.totalViews)}</strong>
        </div>
        <div className="blk kpi bg-blue">
          <span>총 재생시간(영상 길이 합)</span>
          <strong>{fmtTotalDuration(st.data?.summary.totalDurationSeconds || 0)}</strong>
        </div>
      </section>

      <section className="blk">
        <BlockTitle color="mint">일자별 올린 개수</BlockTitle>
        {st.loading && !st.data ? (
          <Loading />
        ) : (
          <div className="chart-wrap">
            <div className="chart" role="img" aria-label="일자별 업로드 개수 막대">
              {st.data?.daily.map((d) => (
                <div key={d.date} className="chart-col" title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}>
                  <span className="chart-val">{d.count > 0 ? d.count : ''}</span>
                  <div className="chart-track">
                    {d.count > 0 && <div className="chart-bar" style={{ height: `${(d.count / maxCount) * 100}%` }} />}
                  </div>
                  <span className={`chart-label${d.date.slice(8) === '01' ? ' first' : ''}`}>{Number(d.date.slice(8))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {st.data && st.data.perPerson.length > 0 && (
        <section className="blk">
          <BlockTitle color="blue">직원별</BlockTitle>
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
                    <td className="strong">{p.name}</td>
                    <td className="num">{fmtNumber(p.videoCount)}</td>
                    <td className="num strong">{fmtNumber(p.totalViews)}</td>
                    <td className="num">{fmtTotalDuration(p.totalDurationSeconds)}</td>
                    <td className="right">
                      <button className="btn yellow sm" onClick={() => st.setWho(p.userId === me.id ? 'me' : p.userId)}>
                        영상 보기 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="blk">
        <BlockTitle
          color="pink"
          right={
            <div className="seg">
              {SORTS.map(([k, label]) => (
                <button key={k} type="button" className={sort === k ? 'on' : ''} aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
          }
        >
          영상 ({fmtNumber(videos.length)})
        </BlockTitle>
        {st.loading && !st.data ? (
          <Loading />
        ) : videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <ul className="vcards stats">
            {videos.map((v) => (
              <li key={v.id} className="vcard">
                <a href={v.url} target="_blank" rel="noreferrer" className="vthumb">
                  <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  <span className="vdur">{fmtDuration(v.durationSeconds)}</span>
                </a>
                <div className="vbody">
                  <a href={v.url} target="_blank" rel="noreferrer" className="vtitle">
                    {v.title}
                  </a>
                  <div className="meta-row">
                    <span className="chip">{v.stockName}</span>
                    {showOwner && v.ownerName ? <span className="owner">{v.ownerName}</span> : null}
                  </div>
                </div>
                <div className="vviews">
                  <span>조회수</span>
                  <strong>{fmtNumber(v.viewCount)}</strong>
                </div>
                <dl className="vmeta">
                  <div>
                    <dt>재생시간</dt>
                    <dd>{fmtDuration(v.durationSeconds)}</dd>
                  </div>
                  <div>
                    <dt>올린 날짜</dt>
                    <dd>{fmtDate(v.publishedAt || v.createdAt)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
