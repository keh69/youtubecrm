'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMenuGuard } from '@/lib/crm/client/hooks'
import { api } from '@/lib/crm/client/api'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { Loading, Note, PageHead, type Msg } from '../../_components/ui'
import { DbGrid, type DbData, type RowKind } from './db-grid'

// 디비입력(v5): 한 달 표에 직원(세로) × 날짜(가로)로 하루 DB 개수를 직접 적는다.
// [이름 추가]로 회원가입 안 한 사람(기타)도 넣을 수 있다. 기타는 데이터 저장용이라 통계에 넣지 않는다.
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1, 12)).toISOString().slice(0, 7)
}

export default function V5DbInput() {
  const allowed = useMenuGuard('db_input')
  const thisMonth = todayKst().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<DbData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<Msg>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    setLoading(true)
    const res = await api<DbData>(`/api/db-counts?month=${month}`)
    if (my !== seq.current) return
    if (res.ok) {
      setData(res.data)
      setError('')
    } else setError(res.error)
    setLoading(false)
  }, [month])
  useEffect(() => {
    void load()
  }, [load])

  // 칸 하나 저장. 성공하면 화면의 값도 바꾼다
  const save = async (kind: RowKind, id: string, date: string, count: number | null) => {
    const res = await api(`/api/db-counts`, { method: 'PUT', body: { ...(kind === 'user' ? { userId: id } : { extraId: id }), date, count } })
    if (!res.ok) return res.error
    setData((d) => {
      if (!d) return d
      if (kind === 'user') return { ...d, counts: [...d.counts.filter((c) => !(c.userId === id && c.date === date)), ...(count === null ? [] : [{ userId: id, date, count }])] }
      return { ...d, extraCounts: [...d.extraCounts.filter((c) => !(c.personId === id && c.date === date)), ...(count === null ? [] : [{ personId: id, date, count }])] }
    })
    return null
  }

  // 기타 이름 추가 / 지우기
  const addName = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return setNote({ tone: 'error', text: '추가할 이름을 적어 주세요.' })
    setAdding(true)
    const res = await api<{ extra: { id: string; name: string; tag: string } }>('/api/db-counts/extra', { method: 'POST', body: { name } })
    setAdding(false)
    if (!res.ok) return setNote({ tone: 'error', text: res.error })
    setNewName('')
    setNote({ tone: 'ok', text: `'${name}' (기타)를 추가했습니다. 통계에는 들어가지 않습니다.` })
    setData((d) => (d ? { ...d, extras: [...d.extras, res.data.extra].sort((a, b) => a.name.localeCompare(b.name, 'ko')) } : d))
  }
  const editExtra = async (id: string, name: string, tag: string) => {
    const res = await api<{ extra: { id: string; name: string; tag: string } }>('/api/db-counts/extra', { method: 'PATCH', body: { id, name, tag } })
    if (!res.ok) return res.error
    setNote({ tone: 'ok', text: `'${res.data.extra.name} (${res.data.extra.tag})'로 바꿨습니다.` })
    setData((d) => (d ? { ...d, extras: d.extras.map((x) => (x.id === id ? res.data.extra : x)).sort((a, b) => a.name.localeCompare(b.name, 'ko')) } : d))
    return null
  }
  const removeExtra = async (id: string, name: string) => {
    if (!window.confirm(`'${name}' 이름과 이 사람의 모든 달 DB 기록을 지울까요? 되돌릴 수 없습니다.`)) return
    const res = await api(`/api/db-counts/extra?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return setNote({ tone: 'error', text: res.error })
    setNote({ tone: 'ok', text: `'${name}'을(를) 지웠습니다.` })
    setData((d) => (d ? { ...d, extras: d.extras.filter((x) => x.id !== id), extraCounts: d.extraCounts.filter((c) => c.personId !== id) } : d))
  }

  if (!allowed) return null
  const [y, m] = month.split('-').map(Number)
  const total = data?.counts.reduce((s, c) => s + c.count, 0) || 0

  return (
    <>
      <PageHead emoji="🗂️" title="디비입력" desc="직원마다 하루에 나온 DB 개수를 날짜 칸을 눌러 직접 적습니다. 적은 숫자는 영상통계·통계비교의 DB 지표에 바로 잡힙니다." />

      <section className="g-glass db-head">
        <div className="db-month" role="group" aria-label="달 고르기">
          <button type="button" className="g-btn ghost sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
            ◀
          </button>
          <b>
            {y}년 {m}월
          </b>
          <button type="button" className="g-btn ghost sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="다음 달">
            ▶
          </button>
          {month !== thisMonth && (
            <button type="button" className="g-btn ghost sm" onClick={() => setMonth(thisMonth)}>
              이번 달
            </button>
          )}
        </div>
        <form className="db-add" onSubmit={addName}>
          <input className="g-input sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="회원가입 안 한 사람 이름" maxLength={40} aria-label="추가할 이름" />
          <button className="g-btn primary sm" disabled={adding || !data?.extraReady}>
            {adding ? '추가 중…' : '+ 이름 추가'}
          </button>
        </form>
        <span className="db-total" title="직원 합계(기타 제외)">
          이 달 합계 <b>{fmtNumber(total)}</b>
        </span>
        {loading && data && <span className="g-spinner g-filters-spin" aria-label="불러오는 중" />}
        <span className="g-muted db-tip">칸을 누르고 숫자를 적은 뒤 Enter(다음 날로) · ↑↓(다른 사람) · 칸을 비우면 지워집니다(안 적은 칸은 0으로 셉니다). 추가한 이름은 (기타)로 표시되고 통계에는 들어가지 않으며, 오른쪽 클릭으로 수정·삭제합니다.</span>
      </section>

      <Note msg={note} />
      {error && <Note msg={{ tone: 'error', text: error }} role="alert" />}
      {data && !data.ready && <Note msg={{ tone: 'error', text: data.hint || 'DB 표가 아직 없습니다.' }} role="alert" />}
      {data && data.ready && !data.extraReady && <Note msg={{ tone: 'error', text: data.extraHint || '기타 이름 표가 아직 없습니다.' }} role="alert" />}
      <section className="g-glass">
        {!data ? <Loading /> : data.people.length === 0 && data.extras.length === 0 ? <p className="g-empty">DB를 적을 사람이 없습니다.</p> : <DbGrid key={data.month} data={data} onSave={save} onRemoveExtra={removeExtra} onEditExtra={editExtra} />}
      </section>
    </>
  )
}
