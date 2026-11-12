'use client'

import { useState } from 'react'

import { STAT_PERIODS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtDate, fmtDuration, fmtNumber, fmtTotalDuration, fmtYmdShort, todayKst, videoFormatLabel } from '@/lib/crm/client/format'
import { Empty, Loading, Note, PageHead } from '../../_components/ui'
import { VideoTable } from '@/components/video-table'
import { StatsDailySection, StatsKpiSection, StatsPersonSection } from '@/components/stats-dataset'

export default function V5Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const [day, setDay] = useState<{ ymd: string; n: number } | null>(null) // 일자별 표에서 누른 날 → 영상리스트 거르기 (v5)

  if (!allowed) return null
  const videos = st.videos

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
        {st.loading && st.data && <span className="g-spinner g-filters-spin" aria-label="새로 불러오는 중" />}
      </section>

      {st.error && <Note msg={{ tone: 'error', text: st.error }} role="alert" />}

      {/* 요약 한 줄 · 일자별 표 · 담당자별 표 (components/stats-dataset.tsx, 모든 스킨 공통) */}
      <StatsKpiSection st={st} />
      <StatsDailySection st={st} pickedDay={day?.ymd ?? null} onPickDay={(ymd) => setDay({ ymd, n: Date.now() })} />
      <StatsPersonSection st={st} meId={me.id} />

      <section className="g-glass">
        <div className="g-card-head">
          <h2 className="g-h2">영상리스트 ({fmtNumber(videos.length)})</h2>
        </div>
        {/* 영상 표: 열별 필터 + 영상통계 '수정권한'이면 줄마다 수정·삭제 */}
        {st.loading && !st.data ? (
          <Loading />
        ) : (
          <VideoTable videos={st.videos} dayFilter={day} canEdit={Boolean(me.canEditStatsVideos)} onChanged={st.reload} cls={{ wrap: 'g-table-wrap', table: 'g-table g-vtable', vcell: 'g-vcell', thumb: 'g-thumb', vtitle: 'g-vtitle', format: 'g-format', formatLong: 'long', formatShort: 'short', who: 'g-who', chip: 'g-chip accent', btn: 'g-btn ghost sm', btnPrimary: 'g-btn primary sm', btnDanger: 'g-btn soft-danger sm', input: 'g-input sm', empty: 'g-empty', msg: 'g-msg ok' }} emptyText="이 기간에 올린 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
