'use client'

import { useState } from 'react'
import { STAT_PERIODS, useMenuGuard, useSession, useStats } from '@/lib/crm/client/hooks'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { BlockTitle, Empty, Loading, Msg, PageHead } from '../../_components/ui'
import { VideoFilterBar, useVideoFilters } from '@/components/video-filters'
import { VideoTable } from '@/components/video-table'
import { StatsDailySection, StatsKpiSection, StatsPersonSection } from '@/components/stats-dataset'
import { StatsByRuntime, StatsByStock } from '@/components/stats-breakdown'

export default function V4Stats() {
  const allowed = useMenuGuard('stats')
  const { me } = useSession()
  const st = useStats()
  const vf = useVideoFilters(st.videos) // 영상 표 열별 필터(여러 개 동시에)
  const [day, setDay] = useState<{ ymd: string; n: number; channel?: string | null } | null>(null) // 일자별 표에서 누른 날 → 영상리스트 거르기
  if (!allowed) return null

  const videos = vf.filtered

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
        {st.loading && st.data && <span className="refreshing">새로 고치는 중…</span>}
      </section>

      {st.error && <Msg tone="error">{st.error}</Msg>}

      {/* 요약 한 줄 · 일자별 표 · 담당자별 표 (components/stats-dataset.tsx, 모든 스킨 공통) */}
      <StatsKpiSection st={st} />
      <StatsDailySection st={st} pickedDay={day?.ymd ?? null} pickedChannel={day?.channel ?? null} onPickDay={(ymd, channel) => setDay({ ymd, channel: channel ?? null, n: Date.now() })} />
      <StatsPersonSection st={st} meId={me.id} />
      {/* 종목별 · 러닝타임별 (components/stats-breakdown.tsx) */}
      <StatsByStock st={st} />
      <StatsByRuntime st={st} />

      <section className="blk">
        <BlockTitle color="pink">
          영상리스트 ({fmtNumber(videos.length)})
        </BlockTitle>
        {st.loading && !st.data ? (
          <Loading />
        ) : st.videos.length === 0 ? (
          <Empty>이 기간에 올린 영상이 없습니다.</Empty>
        ) : (
          <VideoTable videos={st.videos} dayFilter={day} canEdit={Boolean(me.canEditStatsVideos)} onChanged={st.reload} cls={{wrap: 'tbl-wrap', table: 'tbl vtbl', vcell: 'xs-vcell', thumb: 'vrow-thumb', vtitle: 'vtitle', format: 'xs-chip', chip: 'chip', btn: 'btn white sm', btnPrimary: 'btn mint sm', btnDanger: 'btn red sm', input: 'xs-input sm'}} emptyText="이 기간에 올린 영상이 없습니다." />
        )}
      </section>
    </>
  )
}
