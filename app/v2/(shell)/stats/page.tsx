'use client'

import { STAT_PERIODS, STAT_SORTS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead, Panel } from '../../_components/ui'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'
import { VideoTable } from '@/components/video-table'
import { StatsDailySection, StatsKpiSection, StatsPersonSection } from '@/components/stats-dataset'

export default function V2Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)
  if (!allowed) return null

  const videos = vf.filtered
  const sort = st.sort

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

      {/* 요약 한 줄 · 일자별 표 · 담당자별 표 (components/stats-dataset.tsx, 모든 스킨 공통) */}
      <StatsKpiSection st={st} />
      <StatsDailySection st={st} />
      <StatsPersonSection st={st} meId={me.id} />

      <Panel
        label={
          <>
            영상리스트 <span className="count mono">({fmtNumber(videos.length)})</span>
          </>
        }
        right={<span className="muted small">정렬 · {STAT_SORTS.find((o) => o.key === sort)?.label}</span>}
      >
        {st.loading && !st.data ? (
          <Loading />
        ) : st.videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <VideoTable videos={st.videos} canEdit={Boolean(me.canEditStatsVideos)} onChanged={st.reload} cls={{wrap: 'tbl-wrap', table: 'tbl vids', vcell: 'vcell', thumb: 'vthumb', vtitle: 'vtitle', format: 'xs-chip', chip: 'sym', btn: 'key ghost sm', btnPrimary: 'key accent sm', btnDanger: 'key ghost sm danger-text', input: 'xs-input sm'}} emptyText="이 기간에 올린 영상이 없습니다." />
        )}
      </Panel>
    </>
  )
}
