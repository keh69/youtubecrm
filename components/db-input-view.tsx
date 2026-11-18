'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/crm/client/api'
import { fmtNumber, todayKst } from '@/lib/crm/client/format'
import { cx, useSkinCls } from '@/lib/crm/client/skin-ui'
import { DbGrid, type DbData, type RowKind } from '@/components/db-input-grid'

type Msg = { tone: 'ok' | 'error'; text: string } | null

// 디비입력(v5): 한 달 표에 직원(세로) × 날짜(가로)로 하루 DB 개수를 직접 적는다.
// [이름 추가]로 회원가입 안 한 사람(기타)도 넣을 수 있다. 기타는 데이터 저장용이라 통계에 넣지 않는다.
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1, 12)).toISOString().slice(0, 7)
}

// 디비입력 화면 본문(모든 스킨 공용). 각 스킨 페이지는 메뉴 권한 검사와 머리글만 그리고 이것을 넣는다.
export function DbInputView() {
  const k = useSkinCls()
  const thisMonth = todayKst().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<DbData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newTag, setNewTag] = useState('재택') // 이름 옆 꼬리표 (처음 '재택', 비우면 '기타')
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
    const tag = newTag.trim() || '기타'
    const res = await api<{ extra: { id: string; name: string; tag: string } }>('/api/db-counts/extra', { method: 'POST', body: { name, tag } })
    setAdding(false)
    if (!res.ok) return setNote({ tone: 'error', text: res.error })
    setNewName('') // 꼬리표는 그대로 둬서 같은 꼬리표로 여러 명을 이어서 넣기 쉽게
    setNote({ tone: 'ok', text: `'${name} (${res.data.extra.tag})'를 추가했습니다. 통계에는 들어가지 않습니다.` })
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

  const [y, m] = month.split('-').map(Number)
  const total = data?.counts.reduce((s, c) => s + c.count, 0) || 0

  return (
    <>

      <section className={cx(k.section, 'db-head')}>
        <div className="db-month" role="group" aria-label="달 고르기">
          <button type="button" className={k.btn} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
            ◀
          </button>
          <b>
            {y}년 {m}월
          </b>
          <button type="button" className={k.btn} onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="다음 달">
            ▶
          </button>
          {month !== thisMonth && (
            <button type="button" className={k.btn} onClick={() => setMonth(thisMonth)}>
              이번 달
            </button>
          )}
        </div>
        <form className="db-add" onSubmit={addName}>
          <input className={k.inputSm} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="회원가입 안 한 사람 이름" maxLength={40} aria-label="추가할 이름" />
          <span className="db-add-tag" title="이름 옆에 (꼬리표)로 보입니다. 비우면 (기타)">
            ( <input className={k.inputSm} value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="기타" maxLength={10} aria-label="꼬리표" /> )
          </span>
          <button className={k.btnPrimary} disabled={adding || !data?.extraReady}>
            {adding ? '추가 중…' : '+ 이름 추가'}
          </button>
        </form>
        <span className="db-total" title="직원 합계(기타 제외)">
          이 달 합계 <b>{fmtNumber(total)}</b>
        </span>
        {loading && data && <span className={k.v5 ? 'g-spinner g-filters-spin' : 'xs-muted'} aria-label="불러오는 중" />}
        <span className={cx(k.muted, 'db-tip')}>칸을 누르고 숫자를 적은 뒤 Enter(다음 날로) · ↑↓(다른 사람) · 칸을 비우면 지워집니다(안 적은 칸은 0으로 셉니다). 추가한 이름은 (기타)로 표시되고 통계에는 들어가지 않으며, 오른쪽 클릭으로 수정·삭제합니다.</span>
      </section>

      {note && <p className={note.tone === 'ok' ? k.msgOk : k.msgErr} role="status">{note.text}</p>}
      {error && <p className={k.msgErr} role="alert">{error}</p>}
      {data && !data.ready && <p className={k.msgErr} role="alert">{data.hint || 'DB 표가 아직 없습니다.'}</p>}
      {data && data.ready && !data.extraReady && <p className={k.msgErr} role="alert">{data.extraHint || '기타 이름 표가 아직 없습니다.'}</p>}
      <section className={k.section}>
        {!data ? <p className={k.muted}>불러오는 중…</p> : data.people.length === 0 && data.extras.length === 0 ? <p className={k.v5 ? 'g-empty' : 'xs-empty'}>DB를 적을 사람이 없습니다.</p> : <DbGrid key={data.month} data={data} onSave={save} onRemoveExtra={removeExtra} onEditExtra={editExtra} />}
      </section>
    </>
  )
}
