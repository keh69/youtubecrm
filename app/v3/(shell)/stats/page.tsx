'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'
import { VideoTable } from '@/components/video-table'
import { StatsDailySection, StatsKpiSection, StatsPersonSection } from '@/components/stats-dataset'

export default function V3Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)
  if (!allowed) return null
  const videos = vf.filtered

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

      {/* 요약 한 줄 · 일자별 표 · 담당자별 표 (components/stats-dataset.tsx, 모든 스킨 공통) */}
      <StatsKpiSection st={st} />
      <StatsDailySection st={st} />
      <StatsPersonSection st={st} meId={me.id} />

      <hr className="j-double" />

      <section className="j-section">
        <div className="j-section-head">
          <h2 className="j-h2">영상리스트 ({fmtNumber(videos.length)})</h2>
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
