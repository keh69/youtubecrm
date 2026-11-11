'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst } from '@/lib/crm/client/format'
import { Empty, FormatChip, Loading, Note, PageHead, Panel } from '../../_components/ui'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'

export default function V2Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)
  if (!allowed) return null

  const videos = vf.filtered
  const sort = st.sort
  const daily = st.data?.daily || []
  const maxCount = Math.max(1, ...daily.map((d) => d.count))
  const rangeText = st.from === st.to ? fmtYmdShort(st.from) : `${fmtYmdShort(st.from)} ~ ${fmtYmdShort(st.to)}`
  // 막대가 많으면 날짜 라벨을 듬성듬성 찍는다.
  const labelEvery = daily.length > 60 ? 7 : daily.length > 31 ? 3 : 1

  return (
    <>
      <PageHead code="STA-01" title="영상통계" desc="업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다)." />

      <section className="filterbar">
        {st.canPickPeople && (
          <label className="fld">
            <span className="lbl">담당자</span>
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
            {STAT_PERIODS.map((p) => (
              <button key={p.key} type="button" className={st.period === p.key ? 'on' : ''} onClick={() => st.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="fld">
          <span className="lbl">특정날짜</span>
          <input type="date" className="mono" value={st.date} max={todayKst()} onChange={(e) => st.setDate(e.target.value)} />
        </label>
        <div className="fld">
          <span className="lbl">정렬</span>
          <div className="seg">
            {STAT_SORTS.map((o) => (
              <button key={o.key} type="button" className={st.sort === o.key ? 'on' : ''} onClick={() => st.setSort(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {st.loading && st.data && <span className="sync mono">SYNC…</span>}
      </section>

      {st.error && <Note msg={{ tone: 'error', text: st.error }} />}

      <section className="kpis">
        <div className="kpi">
          <span className="sect">올린 영상 · {rangeText}</span>
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

      {daily.length > 1 && (
        <Panel label="일자별 올린 개수" right={<span className="muted small mono">MAX {maxCount}</span>}>
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
        </Panel>
      )}

      {st.data && st.data.perPerson.length > 0 && (
        <Panel label="담당자별">
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
        right={<span className="muted small">정렬 · {STAT_SORTS.find((o) => o.key === sort)?.label}</span>}
      >
        {st.loading && !st.data ? (
          <Loading />
        ) : st.videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <>
          <VideoFilterBar ctl={vf} total={st.videos.length} />
          <div className="tbl-wrap">
            <table className="tbl vids">
              <thead>
                <tr>
                  <th className={sort === 'date' ? 'sorted' : ''}>올린 날짜</th>
                  <th>영상</th>
                  <th className={`num ${sort === 'duration' ? 'sorted' : ''}`}>재생시간</th>
                  <th>형식</th>
                  <th className={sort === 'owner' ? 'sorted' : ''}>담당자</th>
                  <th>종목</th>
                  <th className={`num ${sort === 'views' ? 'sorted' : ''}`}>조회수</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td className="mono nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
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
                    <td className="num">{fmtDuration(v.durationSeconds)}</td>
                    <td>
                      <FormatChip video={v} />
                    </td>
                    <td className="nowrap owner">{v.ownerName || '-'}</td>
                    <td>
                      <span className="sym">{v.stockName}</span>
                    </td>
                    <td className="num">{fmtNumber(v.viewCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {videos.length === 0 && <p className="xs-empty">필터에 맞는 영상이 없습니다.</p>}
          </>
        )}
      </Panel>
    </>
  )
}
