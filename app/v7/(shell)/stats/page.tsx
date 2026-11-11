'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats, type StatSort } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst, videoFormatLabel } from '@/lib/crm/client/format'
import { GridStatus, SqlQuery, sqlStr } from '../../_ui/sql'

const ORDER_BY: Record<StatSort, string> = {
  date: 'published_at DESC',
  views: 'view_count DESC',
  owner: 'owner ASC, view_count DESC',
  duration: 'duration DESC'
}

export default function V7Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  if (!allowed) return null

  const maxCount = Math.max(1, ...(st.data?.daily.map((d) => d.count) || [0]))
  const videos = st.videos
  const rangeText = st.from === st.to ? fmtYmdShort(st.from) : `${fmtYmdShort(st.from)} ~ ${fmtYmdShort(st.to)}`
  const rangeRaw = st.from === st.to ? st.from : `${st.from} ~ ${st.to}`
  const whoName = st.who === 'me' ? me.name : st.who === 'all' ? null : st.data?.people.find((p) => p.id === st.who)?.name || st.who
  const sortLabel = STAT_SORTS.find((s) => s.key === st.sort)?.label

  const query = [
    '-- 업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다).',
    'SELECT title, owner, stock_name, view_count, duration, published_at',
    '  FROM videos',
    ` WHERE published_at BETWEEN ${sqlStr(st.from)} AND ${sqlStr(st.to)}`,
    ...(whoName ? [`   AND owner = ${sqlStr(whoName)}`] : ['   -- owner = 전체 직원']),
    ` ORDER BY ${ORDER_BY[st.sort]};`
  ].join('\n')

  return (
    <>
      <div className="page-head">
        <h1>영상통계</h1>
        <SqlQuery file="video_stats.sql" code={query} />
      </div>

      <section className="card filters">
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
              <button key={p.key} type="button" className={st.period === p.key ? 'on' : ''} onClick={() => st.setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>특정날짜</span>
          <input type="date" value={st.date} max={todayKst()} onChange={(e) => st.setDate(e.target.value)} />
        </label>
        <div className="field">
          <span>정렬</span>
          <div className="seg">
            {STAT_SORTS.map((s) => (
              <button key={s.key} type="button" className={st.sort === s.key ? 'on' : ''} onClick={() => st.setSort(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {st.error && <p className="msg error">{st.error}</p>}

      <section className="kpis">
        <div className="card kpi">
          <span>COUNT(*) · 올린 영상 · {rangeText}</span>
          <strong>{fmtNumber(st.data?.summary.videoCount)}개</strong>
        </div>
        <div className="card kpi">
          <span>SUM(view_count) · 총 조회수</span>
          <strong>{fmtNumber(st.data?.summary.totalViews)}</strong>
        </div>
        <div className="card kpi">
          <span>SUM(duration) · 총 재생시간(영상 길이 합)</span>
          <strong>{fmtTotalDuration(st.data?.summary.totalDurationSeconds || 0)}</strong>
        </div>
      </section>

      {(st.data?.daily.length || 0) > 1 && (
        <section className="card">
          <h2>일자별 올린 개수</h2>
          <div className="bars" role="img" aria-label="일자별 업로드 개수 막대">
            {st.data?.daily.map((d) => (
              <div key={d.date} className="bar-col" title={`${fmtYmdShort(d.date)} · ${d.count}개 · 조회수 ${fmtNumber(d.views)}`}>
                <span className="bar-val">{d.count > 0 ? d.count : ''}</span>
                <div className="bar" style={{ height: `${(d.count / maxCount) * 100}%` }} />
                <span className="bar-label">{Number(d.date.slice(8))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {st.data && st.data.perPerson.length > 0 && (
        <section className="card">
          <h2>결과 · 담당자별</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="rn">#</th>
                  <th>담당자</th>
                  <th className="num">영상</th>
                  <th className="num">총 조회수</th>
                  <th className="num">총 재생시간</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {st.data.perPerson.map((p, i) => (
                  <tr key={p.userId}>
                    <td className="rn">{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="num">{fmtNumber(p.videoCount)}</td>
                    <td className="num">{fmtNumber(p.totalViews)}</td>
                    <td className="num">{fmtTotalDuration(p.totalDurationSeconds)}</td>
                    <td className="right">
                      <button className="btn ghost small" onClick={() => st.setWho(p.userId === me.id ? 'me' : p.userId)}>
                        영상 보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <GridStatus rows={st.data.perPerson.length}>기간 {rangeRaw} · GROUP BY owner</GridStatus>
        </section>
      )}

      <section className="card">
        <h2>결과 · 영상 ({fmtNumber(videos.length)})</h2>
        {st.loading && !st.data ? (
          <p className="muted">불러오는 중…</p>
        ) : videos.length === 0 ? (
          <p className="empty">이 기간에 올린 영상이 없습니다.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table vtable">
                <thead>
                  <tr>
                    <th className="rn">#</th>
                    <th>영상</th>
                    <th>담당자</th>
                    <th>종목</th>
                    <th className="num">조회수</th>
                    <th className="num">재생시간</th>
                    <th>형식</th>
                    <th>올린 날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v, i) => (
                    <tr key={v.id}>
                      <td className="rn">{i + 1}</td>
                      <td>
                        <div className="vcell">
                          <a href={v.url} target="_blank" rel="noreferrer" className="thumb">
                            <img src={v.thumbnailUrl} alt="" loading="lazy" />
                          </a>
                          <a href={v.url} target="_blank" rel="noreferrer" className="video-title">
                            {v.title}
                          </a>
                        </div>
                      </td>
                      <td className="nowrap">{v.ownerName || '-'}</td>
                      <td>
                        <span className="chip">{v.stockName}</span>
                      </td>
                      <td className="num">{fmtNumber(v.viewCount)}</td>
                      <td className="num">{fmtDuration(v.durationSeconds)}</td>
                      <td className="nowrap">{videoFormatLabel(v)}</td>
                      <td className="num nowrap">{fmtDate(v.publishedAt || v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <GridStatus rows={videos.length}>
              기간 {rangeRaw} · 정렬 {sortLabel}
            </GridStatus>
          </>
        )}
      </section>
    </>
  )
}
