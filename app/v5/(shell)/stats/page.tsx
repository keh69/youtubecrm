'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst, videoFormatLabel } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'
import { VideoTable } from '@/components/video-table'

// 일자별 표 도우미
const weekdayOf = (ymd: string) => ['일', '월', '화', '수', '목', '금', '토'][new Date(`${ymd}T12:00:00Z`).getUTCDay()]
const isWeekend = (ymd: string) => {
  const w = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return w === 0 || w === 6
}
// 1만 이상은 1.2만처럼 줄여 좁은 칸에 들어가게
const shortNum = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString('ko-KR'))

export default function V5Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()

  if (!allowed) return null
  const videos = st.videos
  const daily = st.data?.daily || []
  const maxCount = Math.max(1, ...daily.map((d) => d.count))
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

      {/* 요약: 큰 카드 대신 한 줄 수치표 */}
      <section className="g-glass g-ds-kpi" aria-label="기간 요약">
        <dl>
          <div>
            <dt>기간</dt>
            <dd className="small">{rangeText}</dd>
          </div>
          <div>
            <dt>올린 영상</dt>
            <dd>{fmtNumber(st.data?.summary.videoCount)}개</dd>
          </div>
          <div>
            <dt>총 조회수</dt>
            <dd>{fmtNumber(st.data?.summary.totalViews)}</dd>
          </div>
          <div>
            <dt>영상당 평균 조회수</dt>
            <dd>{st.data && st.data.summary.videoCount > 0 ? fmtNumber(Math.round(st.data.summary.totalViews / st.data.summary.videoCount)) : '-'}</dd>
          </div>
          <div>
            <dt>총 재생시간(영상 길이 합)</dt>
            <dd>{fmtTotalDuration(st.data?.summary.totalDurationSeconds || 0)}</dd>
          </div>
        </dl>
      </section>

      {/* 일자별: 날짜를 가로로, 올린 개수·조회수를 줄로 보는 표. 개수 칸은 많을수록 진한 보라(한 색 농도) */}
      {daily.length > 0 && (
        <section className="g-glass">
          <h2 className="g-h2">일자별</h2>
          <div className="g-table-wrap">
            <table className="g-table g-ds-daily">
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  {daily.map((d) => (
                    <th key={d.date} scope="col" className={isWeekend(d.date) ? 'we' : undefined} title={fmtYmdShort(d.date)}>
                      {Number(d.date.slice(8))}
                      <small>{weekdayOf(d.date)}</small>
                    </th>
                  ))}
                  <th scope="col" className="sum">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">올린 개수</th>
                  {daily.map((d) => (
                    <td key={d.date} className={d.count > 0 ? (d.count / maxCount > 0.55 ? 'heat hi' : 'heat') : 'zero'} style={d.count > 0 ? { ['--a' as string]: (0.18 + 0.62 * (d.count / maxCount)).toFixed(2) } : undefined} title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}>
                      {d.count > 0 ? <span className="ds-cell">{d.count}</span> : '·'}
                    </td>
                  ))}
                  <td className="sum">{fmtNumber(daily.reduce((n, d) => n + d.count, 0))}</td>
                </tr>
                <tr>
                  <th scope="row">조회수</th>
                  {daily.map((d) => (
                    <td key={d.date} className={d.views > 0 ? undefined : 'zero'} title={`${fmtYmdShort(d.date)} · 조회수 ${fmtNumber(d.views)}`}>
                      {d.views > 0 ? shortNum(d.views) : '·'}
                    </td>
                  ))}
                  <td className="sum">{shortNum(daily.reduce((n, d) => n + d.views, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="g-muted g-small">올린 개수 칸은 그날 올린 영상이 많을수록 진하게 보입니다. 조회수는 그날 올린 영상들의 지금 조회수 합입니다. 칸에 마우스를 올리면 자세히 보입니다.</p>
        </section>
      )}

      {st.data && st.data.perPerson.length > 0 && (
        <section className="g-glass">
          <h2 className="g-h2">담당자별</h2>
          <div className="g-table-wrap">
            <table className="g-table g-compact">
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
          <h2 className="g-h2">영상리스트 ({fmtNumber(videos.length)})</h2>
          <span className="g-muted g-small">{STAT_SORTS.find((o) => o.key === st.sort)?.label}</span>
        </div>
        {/* 영상 표: 열별 필터 + 영상통계 '수정권한'이면 줄마다 수정·삭제 */}
        {st.loading && !st.data ? (
          <Loading />
        ) : (
          <VideoTable videos={st.videos} canEdit={Boolean(me.canEditStatsVideos)} onChanged={st.reload} cls={{ wrap: 'g-table-wrap', table: 'g-table g-vtable', vcell: 'g-vcell', thumb: 'g-thumb', vtitle: 'g-vtitle', format: 'g-format', formatLong: 'long', formatShort: 'short', who: 'g-who', avatar: 'g-avatar xs', chip: 'g-chip accent', btn: 'g-btn ghost sm', btnPrimary: 'g-btn primary sm', btnDanger: 'g-btn soft-danger sm', input: 'g-input sm', empty: 'g-empty', msg: 'g-msg ok' }} emptyText="이 기간에 올린 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
