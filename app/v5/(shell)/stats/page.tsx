'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst, videoFormatLabel } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'

export default function V5Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)

  if (!allowed) return null
  const videos = vf.filtered
  const daily = st.data?.daily || []
  const maxCount = Math.max(1, ...daily.map((d) => d.count))
  const labelStep = Math.max(1, Math.ceil(daily.length / 15))
  const dense = daily.length > 31
  const rangeText = st.from === st.to ? fmtYmdShort(st.from) : `${fmtYmdShort(st.from)} ~ ${fmtYmdShort(st.to)}`

  return (
    <>
      <PageHead emoji="📊" title="영상통계" desc="업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다)." />

      <section className="g-glass g-filters">
        {st.canPickPeople && (
          <label className="g-field">
            <span>담당자</span>
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
          <div className="g-seg" role="group" aria-label="기간">
            {STAT_PERIODS.map((p) => (
              <button key={p.key} type="button" className={st.period === p.key ? 'on' : ''} aria-pressed={st.period === p.key} onClick={() => st.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="g-field">
          <span>특정날짜</span>
          <input className="g-input g-date" type="date" value={st.date} max={todayKst()} onChange={(e) => st.setDate(e.target.value)} />
        </label>
        <div className="g-field">
          <span>정렬</span>
          <div className="g-seg" role="group" aria-label="정렬">
            {STAT_SORTS.map((o) => (
              <button key={o.key} type="button" className={st.sort === o.key ? 'on' : ''} aria-pressed={st.sort === o.key} onClick={() => st.setSort(o.key)}>
                {o.label}
              </button>
            ))}
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
          <small>올린 영상 · {rangeText}</small>
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

      {daily.length > 1 && (
        <section className="g-glass">
          <h2 className="g-h2">일자별 올린 개수</h2>
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
        </section>
      )}

      {st.data && st.data.perPerson.length > 0 && (
        <section className="g-glass">
          <h2 className="g-h2">담당자별</h2>
          <div className="g-table-wrap">
            <table className="g-table">
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
          <span className="g-muted g-small">{STAT_SORTS.find((o) => o.key === st.sort)?.label}</span>
        </div>
        {st.videos.length > 0 && <VideoFilterBar ctl={vf} total={st.videos.length} />}
        {st.loading && !st.data ? (
          <Loading />
        ) : st.videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : videos.length === 0 ? (
          <Empty>필터에 맞는 영상이 없습니다.</Empty>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table g-vtable">
              <thead>
                {/* 열 순서: 올린 날짜 · 영상 · 재생시간 · 폼종류 · 종목 · 담당자 · 조회수 */}
                <tr>
                  <th>올린 날짜</th>
                  <th>영상</th>
                  <th className="num">재생시간</th>
                  <th>폼종류</th>
                  <th>종목</th>
                  <th>담당자</th>
                  <th className="num">조회수</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => {
                  const fmt = videoFormatLabel(v)
                  return (
                    <tr key={v.id}>
                      <td className="num nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                      <td>
                        <div className="g-vcell">
                          <a href={v.url} target="_blank" rel="noreferrer" className="g-thumb" aria-label={`${v.title} 유튜브에서 보기`}>
                            <img src={v.thumbnailUrl} alt="" loading="lazy" />
                          </a>
                          <a href={v.url} target="_blank" rel="noreferrer" className="g-vtitle">
                            {v.title}
                          </a>
                        </div>
                      </td>
                      <td className="num nowrap">{fmtDuration(v.durationSeconds)}</td>
                      <td>
                        <span className={`g-format ${fmt === '롱폼' ? 'long' : 'short'}`}>{fmt}</span>
                      </td>
                      <td>
                        <span className="g-chip accent">{v.stockName}</span>
                      </td>
                      <td className="nowrap">
                        <span className="g-who">
                          <span className="g-avatar xs">{(v.ownerName || '-').slice(0, 1)}</span>
                          {v.ownerName || '-'}
                        </span>
                      </td>
                      <td className="num">{fmtNumber(v.viewCount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
