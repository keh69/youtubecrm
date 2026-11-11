'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst, videoFormatLabel } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead } from '../../_components/ui'

export default function V4Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  if (!allowed) return null

  const maxCount = Math.max(1, ...(st.data?.daily.map((d) => d.count) || [0]))
  const videos = st.videos
  const rangeText = st.from === st.to ? fmtYmdShort(st.from) : `${fmtYmdShort(st.from)} ~ ${fmtYmdShort(st.to)}`

  return (
    <>
      <PageHead title="영상통계" tag="숫자 쾅!" desc="업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다)." />

      <section className="blk filters">
        {st.canPickPeople && (
          <label className="field">
            <span>담당자</span>
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
            {STAT_PERIODS.map((p) => (
              <button key={p.key} type="button" className={st.period === p.key ? 'on' : ''} aria-pressed={st.period === p.key} onClick={() => st.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>특정날짜</span>
          <input type="date" value={st.date} max={todayKst()} onChange={(e) => e.target.value && st.setDate(e.target.value)} />
        </label>
        <div className="field">
          <span>정렬</span>
          <div className="seg">
            {STAT_SORTS.map((o) => (
              <button key={o.key} type="button" className={st.sort === o.key ? 'on' : ''} aria-pressed={st.sort === o.key} onClick={() => st.setSort(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {st.loading && st.data && <span className="refreshing">새로 고치는 중…</span>}
      </section>

      {st.error && <Msg tone="error">{st.error}</Msg>}

      <section className="kpis">
        <div className="blk kpi bg-yellow">
          <span>올린 영상 · {rangeText}</span>
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

      {(st.data?.daily.length || 0) > 1 && (
        <section className="blk">
          <BlockTitle color="mint">일자별 올린 개수</BlockTitle>
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
        </section>
      )}

      {st.data && st.data.perPerson.length > 0 && (
        <section className="blk">
          <BlockTitle color="blue">담당자별</BlockTitle>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>담당자</th>
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
        <BlockTitle color="pink">
          영상 ({fmtNumber(videos.length)})
        </BlockTitle>
        {st.loading && !st.data ? (
          <Loading />
        ) : videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl vtbl">
              <thead>
                <tr>
                  <th>영상</th>
                  <th>담당자</th>
                  <th>형식</th>
                  <th>종목</th>
                  <th className="num">조회수</th>
                  <th className="num">재생시간</th>
                  <th>올린 날짜</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="vrow">
                        <a href={v.url} target="_blank" rel="noreferrer" className="vrow-thumb">
                          <img src={v.thumbnailUrl} alt="" loading="lazy" />
                        </a>
                        <a href={v.url} target="_blank" rel="noreferrer" className="vtitle">
                          {v.title}
                        </a>
                      </div>
                    </td>
                    <td className="nowrap">{v.ownerName ? <span className="owner">{v.ownerName}</span> : '-'}</td>
                    <td className="nowrap">
                      <span className={`fmt-tag ${videoFormatLabel(v) === '롱폼' ? 'f-long' : 'f-short'}`}>{videoFormatLabel(v)}</span>
                    </td>
                    <td>
                      <span className="chip">{v.stockName}</span>
                    </td>
                    <td className="num strong">{fmtNumber(v.viewCount)}</td>
                    <td className="num">{fmtDuration(v.durationSeconds)}</td>
                    <td className="num nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
