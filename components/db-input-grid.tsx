'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtNumber, fmtYmdShort } from '@/lib/crm/client/format'
import { cx, useSkinCls } from '@/lib/crm/client/skin-ui'

// 디비입력 표: 직원(세로) × 날짜(가로). 칸을 눌러 숫자를 적고 Enter·칸 밖을 누르면 저장한다.
// 직원 아래에는 '기타'(회원가입 안 한 사람, 이름만 추가) 줄이 붙는다. 기타는 데이터 저장용이라 통계·합계에 넣지 않는다.
export type DbData = {
  month: string
  from: string
  to: string
  today: string
  ready: boolean
  hint: string | null
  people: Array<{ id: string; name: string; loginId: string; affiliationName: string | null }>
  counts: Array<{ userId: string; date: string; count: number }>
  extraReady: boolean
  extraHint: string | null
  extras: Array<{ id: string; name: string; tag: string }>
  extraCounts: Array<{ personId: string; date: string; count: number }>
}
export type RowKind = 'user' | 'extra'

const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay()
const WD = ['일', '월', '화', '수', '목', '금', '토']

type GridRow = { kind: RowKind; id: string; name: string; title: string; tag?: string }

export function DbGrid({
  data,
  onSave,
  onRemoveExtra,
  onEditExtra
}: {
  data: DbData
  onSave: (kind: RowKind, id: string, date: string, count: number | null) => Promise<string | null>
  onRemoveExtra: (id: string, name: string) => void
  onEditExtra: (id: string, name: string, tag: string) => Promise<string | null>
}) {
  const k = useSkinCls() // 2026-11-18 '0': 모든 스킨
  const days = Array.from({ length: Number(data.to.slice(8)) }, (_, i) => `${data.month}-${String(i + 1).padStart(2, '0')}`)
  const value = new Map<string, number>([...data.counts.map((c) => [`user:${c.userId}|${c.date}`, c.count] as const), ...data.extraCounts.map((c) => [`extra:${c.personId}|${c.date}`, c.count] as const)])
  const rows: GridRow[] = [
    ...data.people.map((p) => ({ kind: 'user' as const, id: p.id, name: p.name, title: `${p.name} (${p.loginId})${p.affiliationName ? ` · ${p.affiliationName}` : ''}` })),
    ...data.extras.map((p) => ({ kind: 'extra' as const, id: p.id, name: p.name, tag: p.tag || '기타', title: `${p.name} (${p.tag || '기타'}) · 회원가입 안 함, 통계 제외 · 오른쪽 클릭: 수정·삭제` }))
  ]
  const [draft, setDraft] = useState<Record<string, string>>({}) // 적는 중인 칸
  const [state, setState] = useState<Record<string, 'saving' | 'ok' | 'err'>>({})
  const [msg, setMsg] = useState('')
  const box = useRef<HTMLTableElement>(null)
  // 기타 줄 오른쪽 클릭 메뉴(수정·삭제)와 수정 창
  const [menu, setMenu] = useState<{ x: number; y: number; row: GridRow } | null>(null)
  const [editing, setEditing] = useState<{ x: number; y: number; row: GridRow; name: string; tag: string; busy: boolean; err: string } | null>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e.type === 'pointerdown' && (e.target as HTMLElement).closest('.db-ctx')) return
      setMenu(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])
  // 유리 카드(backdrop-filter) 안에 두면 position: fixed 가 카드 기준이 되어 마우스 자리에서 밀린다 → .v5 바로 아래로 띄운다
  const layer = () => (typeof document !== 'undefined' ? document.querySelector('.v5') || document.body : null)
  const place = (x: number, y: number, w: number, h: number) => ({ left: Math.max(8, Math.min(x, window.innerWidth - w - 8)), top: Math.max(8, Math.min(y, window.innerHeight - h - 8)) })
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const name = editing.name.trim()
    const tag = editing.tag.trim()
    if (!name) return setEditing({ ...editing, err: '이름을 적어 주세요.' })
    if (!tag) return setEditing({ ...editing, err: '꼬리표를 적어 주세요(예: 기타).' })
    setEditing({ ...editing, busy: true, err: '' })
    const err = await onEditExtra(editing.row.id, name, tag)
    if (err) return setEditing((x) => (x ? { ...x, busy: false, err } : x))
    setEditing(null)
  }

  const focusCell = (r: number, c: number) => {
    const el = box.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`)
    if (el && !el.disabled) {
      el.focus()
      el.select()
    }
  }
  const commit = async (row: GridRow, date: string) => {
    const key = `${row.kind}:${row.id}|${date}`
    if (!(key in draft)) return
    const raw = draft[key].trim()
    const before = value.get(key)
    const next = raw === '' ? null : Number(raw)
    setDraft((d) => {
      const { [key]: _, ...rest } = d
      return rest
    })
    if (next !== null && (!Number.isInteger(next) || next < 0)) return setMsg('0 이상의 정수만 적을 수 있습니다.')
    if ((before ?? null) === next) return
    setState((s) => ({ ...s, [key]: 'saving' }))
    const err = await onSave(row.kind, row.id, date, next)
    setState((s) => ({ ...s, [key]: err ? 'err' : 'ok' }))
    setMsg(err || '')
    if (!err) setTimeout(() => setState((s) => (s[key] === 'ok' ? (({ [key]: _, ...rest }) => rest)(s) : s)), 900)
  }

  const rowSum = (row: GridRow) => days.reduce((s, d) => s + (value.get(`${row.kind}:${row.id}|${d}`) || 0), 0)
  const daySum = (d: string, kind: RowKind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + (value.get(`${r.kind}:${r.id}|${d}`) || 0), 0)
  const kindSum = (kind: RowKind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + rowSum(r), 0)
  const passed = days.filter((d) => d <= data.today).length || 1 // 이번 달은 오늘까지 날 수
  const hasExtra = data.extras.length > 0

  const footRow = (kind: RowKind, label: string) => {
    const total = kindSum(kind)
    return (
      <tr className={kind === 'extra' ? 'extra' : undefined}>
        <th scope="row">{label}</th>
        {days.map((d) => {
          const s = daySum(d, kind)
          return (
            <td key={d} className={s ? undefined : 'zero'}>
              {fmtNumber(s)}
            </td>
          )
        })}
        <td className="sum">{fmtNumber(total)}</td>
        <td className="sum avg">{(total / passed).toFixed(1)}</td>
      </tr>
    )
  }

  return (
    <>
      <div className={k.wrap}>
        <table className={k.table('db-grid')} ref={box}>
          <colgroup>
            <col className="c-name" />
            {days.map((d) => (
              <col key={d} />
            ))}
            <col className="c-sum" />
            <col className="c-avg" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">직원</th>
              {days.map((d) => {
                const w = weekday(d)
                return (
                  <th key={d} scope="col" className={`${w === 0 || w === 6 ? 'we' : ''}${d === data.today ? ' today' : ''}`} title={fmtYmdShort(d)}>
                    {Number(d.slice(8))}
                    <small>{WD[w]}</small>
                  </th>
                )
              })}
              <th scope="col" className="sum">
                합계
              </th>
              <th scope="col" className="sum" title="합계 ÷ 이 달에 지난 날 수(오늘까지)">
                일평균
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const extra = row.kind === 'extra'
              const ready = extra ? data.extraReady : data.ready
              const firstExtra = extra && (r === 0 || rows[r - 1].kind !== 'extra')
              return (
                <tr
                  key={`${row.kind}:${row.id}`}
                  className={`${extra ? 'extra' : ''}${firstExtra ? ' first-extra' : ''}`}
                  onContextMenu={
                    extra
                      ? (e) => {
                          e.preventDefault()
                          setEditing(null)
                          setMenu({ x: e.clientX, y: e.clientY, row })
                        }
                      : undefined
                  }
                >
                  <th scope="row" title={row.title}>
                    <span className="db-name">
                      <span className="db-name-text">{row.name}</span>
                      {extra && <small className="db-etc">({row.tag})</small>}
                    </span>
                  </th>
                  {days.map((d, c) => {
                    const key = `${row.kind}:${row.id}|${d}`
                    const saved = value.get(key)
                    const future = d > data.today
                    const shown = key in draft ? draft[key] : saved === undefined ? '' : String(saved)
                    return (
                      <td key={d} className={`${state[key] || ''}${future ? ' future' : ''}${saved ? ' has' : ''}`}>
                        <input
                          className="db-cell"
                          inputMode="numeric"
                          value={shown}
                          disabled={future || !ready}
                          data-r={r}
                          data-c={c}
                          aria-label={`${row.name}${extra ? '(기타)' : ''} ${fmtYmdShort(d)} DB 개수`}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setDraft((x) => ({ ...x, [key]: e.target.value.replace(/[^\d]/g, '') }))}
                          onBlur={() => void commit(row, d)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              focusCell(r, c + 1)
                              if (document.activeElement === e.currentTarget) e.currentTarget.blur()
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              focusCell(r + 1, c)
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              focusCell(r - 1, c)
                            } else if (e.key === 'Escape') {
                              setDraft((x) => {
                                const { [key]: _, ...rest } = x
                                return rest
                              })
                              e.currentTarget.blur()
                            }
                          }}
                        />
                      </td>
                    )
                  })}
                  <td className="sum">{fmtNumber(rowSum(row))}</td>
                  <td className="sum avg">{(rowSum(row) / passed).toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {footRow('user', hasExtra ? '합계(직원)' : '합계')}
            {hasExtra && footRow('extra', '기타 합계')}
          </tfoot>
        </table>
      </div>
      {msg ? (
        <p className={k.msgErr} role="alert">
          {msg}
        </p>
      ) : (
        <p className={k.small}>
          일평균은 합계 ÷ 이 달에 지난 날 수(오늘까지)입니다. 오늘 이후 날짜는 적을 수 없습니다. 저장되면 칸이 잠깐 초록으로 깜빡입니다.
          {hasExtra && ' 추가한 이름 줄은 데이터 저장용이라 영상통계·통계비교에 들어가지 않습니다. 그 줄을 오른쪽 클릭하면 수정·삭제할 수 있습니다.'} 안 적은 칸은 0으로 셉니다.
        </p>
      )}
      {menu &&
        layer() &&
        createPortal(
        <div className="db-ctx" role="menu" style={place(menu.x, menu.y, 160, 110)} onContextMenu={(e) => e.preventDefault()}>
          <div className="db-ctx-title">
            {menu.row.name} ({menu.row.tag})
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setEditing({ x: menu.x, y: menu.y, row: menu.row, name: menu.row.name, tag: menu.row.tag || '기타', busy: false, err: '' })
              setMenu(null)
            }}
          >
            ✏️ 수정
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setMenu(null)
              onRemoveExtra(menu.row.id, menu.row.name)
            }}
          >
            🗑️ 삭제
          </button>
        </div>,
          layer()!
        )}
      {editing &&
        layer() &&
        createPortal(
        <form className="db-ctx db-edit" style={place(editing.x, editing.y, 270, 230)} onSubmit={saveEdit} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
          <div className="db-ctx-title">이름 수정</div>
          <label>
            <span>이름</span>
            <input className={k.inputSm} value={editing.name} maxLength={40} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value, err: '' })} />
          </label>
          <label>
            <span>꼬리표</span>
            <span className="db-tag-edit">
              ( <input className={k.inputSm} value={editing.tag} maxLength={10} onChange={(e) => setEditing({ ...editing, tag: e.target.value, err: '' })} placeholder="기타" /> )
            </span>
          </label>
          <p className="db-edit-preview">
            미리보기: <b>{editing.name.trim() || '이름'}</b> <small className="db-etc">({editing.tag.trim() || '기타'})</small>
          </p>
          {editing.err && <p className="db-edit-err">{editing.err}</p>}
          <div className="db-edit-btns">
            <button type="button" className={k.btn} onClick={() => setEditing(null)}>
              취소
            </button>
            <button className={k.btnPrimary} disabled={editing.busy}>
              {editing.busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>,
          layer()!
        )}
    </>
  )
}
