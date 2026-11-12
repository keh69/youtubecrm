'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'
import { VideoTable } from '@/components/video-table'
import { StatsDailySection, StatsKpiSection, StatsPersonSection } from '@/components/stats-dataset'

export default function V6Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)
  if (!allowed) return null

  const videos = vf.filtered

  return (
    <>
      <div className="page-head">
        <h1>영상통계</h1>
        <p className="muted">업로드 날짜 기준입니다. 조회수는 화면을 열 때 유튜브에서 새로 가져옵니다(30분마다).</p>
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

      {/* 요약 한 줄 · 일자별 표 · 담당자별 표 (components/stats-dataset.tsx, 모든 스킨 공통) */}
      <StatsKpiSection st={st} />
      <StatsDailySection st={st} />
      <StatsPersonSection st={st} meId={me.id} />

      <section className="card">
        <h2>영상리스트 ({fmtNumber(videos.length)})</h2>
        {st.loading && !st.data ? (
          <p className="muted">불러오는 중…</p>
        ) : st.videos.length === 0 ? (
          <p className="empty">이 기간에 올린 영상이 없습니다.</p>
        ) : (
          <VideoTable videos={st.videos} canEdit={Boolean(me.canEditStatsVideos)} onChanged={st.reload} cls={{wrap: 'table-wrap', table: 'table vtable', vcell: 'vcell', thumb: 'thumb', vtitle: 'video-title', format: 'xs-chip', chip: 'chip', btn: 'btn ghost small', btnPrimary: 'btn primary small', btnDanger: 'btn ghost small danger-text', input: 'xs-input sm'}} emptyText="이 기간에 올린 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
