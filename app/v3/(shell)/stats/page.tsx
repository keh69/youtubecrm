'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst, videoFormatLabel } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'
import { VideoTable } from '@/components/video-table'

export default function V3Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)
  if (!allowed) return null
  const videos = vf.filtered
  const daily = st.data?.daily || []
  const maxCount = Math.max(1, ...daily.map((d) => d.count))
  const labelEvery = daily.length <= 31 ? 1 : Math.ceil(daily.length / 15)
  const rangeText = st.from === st.to ? fmtYmdShort(st.from) : `${fmtYmdShort(st.from)} ~ ${fmtYmdShort(st.to)}`

  return (
    <>
      <PageHead kicker="숫자로 보는 지면" title="영상통계">
        업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다).
      </PageHead>

      <section className="j-filters">
        {st.canPickPeople && (
          <label className="j-field">
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
        <div className="j-field">
          <span>기간</span>
          <div className="j-linkset" role="group" aria-label="기간 선택">
            {STAT_PERIODS.map((p) => (
              <button key={p.key} type="button" className={st.period === p.key ? 'on' : ''} aria-pressed={st.period === p.key} onClick={() => st.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="j-field">
          <span>특정날짜</span>
          <input type="date" value={st.date} max={todayKst()} onChange={(e) => st.setDate(e.target.value)} />
        </label>
        <div className="j-field">
          <span>정렬</span>
          <div className="j-linkset" role="group" aria-label="정렬">
            {STAT_SORTS.map((o) => (
              <button key={o.key} type="button" className={st.sort === o.key ? 'on' : ''} aria-pressed={st.sort === o.key} onClick={() => st.setSort(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {st.loading && st.data && <span className="j-refreshing">새로 불러오는 중…</span>}
      </section>

      {st.error && <Note msg={{ tone: 'error', text: st.error }} />}

      <hr className="j-double" />

      <section className="j-kpis">
        <div className="j-kpi">
          <span className="j-label">올린 영상 · {rangeText}</span>
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

      {daily.length > 1 && (
        <>
          <hr className="j-double" />

          <section className="j-section">
            <h2 className="j-h2">일자별 올린 개수</h2>
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
          </section>
        </>
      )}

      {st.data && st.data.perPerson.length > 0 && (
        <>
          <hr className="j-double" />
          <section className="j-section">
            <h2 className="j-h2">담당자별</h2>
            <div className="j-table-wrap">
              <table className="j-table">
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
        </div>
        {st.loading && !st.data ? (
          <Loading />
        ) : st.videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <VideoTable videos={st.videos} canEdit={Boolean(me.canEditStatsVideos)} onChanged={st.reload} cls={{wrap: 'j-table-wrap', table: 'j-table j-vtable', vcell: 'j-vcell', thumb: 'j-thumb', vtitle: 'j-story-title', format: 'j-format', chip: 'j-tag', btn: 'j-textbtn', btnPrimary: 'j-btn ink small', btnDanger: 'j-textbtn danger', input: 'xs-input sm'}} emptyText="이 기간에 올린 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
