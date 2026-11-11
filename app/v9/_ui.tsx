// v9 공용 표시 조각 — 데이터 그리드 머리칸(열 이름 + 타입 힌트), 행 수 바닥줄, 속성 패널.
// 상태·데이터 로직은 없다(모두 lib/crm/client/hooks 쪽).

export function Th({ name, type, className }: { name: React.ReactNode; type?: string; className?: string }) {
  return (
    <th className={className}>
      <span className="th-name">{name}</span>
      {type && <span className="ty">{type}</span>}
    </th>
  )
}

export function RowNoTh() {
  return (
    <th className="rn" aria-label="행 번호">
      #
    </th>
  )
}

export function GridFoot({ count, note }: { count: number; note?: React.ReactNode }) {
  return (
    <div className="grid-foot">
      <span>
        <span className="ok-dot" aria-hidden="true" /> {count.toLocaleString('ko-KR')}행 조회됨
      </span>
      {note && <span className="grid-note">{note}</span>}
    </div>
  )
}

export function Props({ title = '속성', rows }: { title?: string; rows: Array<{ k: string; type?: string; v: React.ReactNode; strong?: boolean }> }) {
  return (
    <div className="props">
      <div className="props-head">
        <span>{title}</span>
        <span className="ty">Properties</span>
      </div>
      <dl>
        {rows.map((r) => (
          <div key={r.k} className={r.strong ? 'strong' : ''}>
            <dt>
              {r.k}
              {r.type && <span className="ty">{r.type}</span>}
            </dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Ico({ children }: { children: React.ReactNode }) {
  return (
    <span className="ico" aria-hidden="true">
      {children}
    </span>
  )
}
