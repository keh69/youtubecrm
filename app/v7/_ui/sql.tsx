// v7 · SQL 콘솔 전용 장식 컴포넌트 (기능 없음, 읽기 전용).
//  - SqlQuery: 페이지 머리의 "쿼리" 블록(줄 번호 + 구문 강조)
//  - GridStatus: 결과 그리드 아래 상태줄 (▸ 12 rows · 기간 …)
//  - sqlStr: 값 → 'SQL 문자열' (작은따옴표 이스케이프)

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'ON', 'JOIN', 'LEFT',
  'ORDER', 'GROUP', 'BY', 'ASC', 'DESC', 'LIMIT', 'BETWEEN', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
  'SET', 'DELETE', 'RETURNING', 'CURRENT_DATE', 'CONNECT', 'TO', 'USER', 'DISTINCT', 'WITH'
])

// 주석 | '문자열' | :파라미터 | 숫자 | 함수( | 식별자 | 연산자
const TOKEN = /(--.*$)|('(?:[^']|'')*')|(:[A-Za-z_]\w*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|([=<>*,;()]+)/g

function highlight(line: string) {
  const out: React.ReactNode[] = []
  let last = 0
  let k = 0
  TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index))
    const text = m[0]
    const cls = m[1]
      ? 't-cm'
      : m[2]
        ? 't-str'
        : m[3]
          ? 't-param'
          : m[4]
            ? 't-num'
            : m[5]
              ? 't-fn'
              : m[6]
                ? KEYWORDS.has(text.toUpperCase())
                  ? 't-kw'
                  : 't-id'
                : 't-op'
    out.push(
      <span key={k++} className={cls}>
        {text}
      </span>
    )
    last = m.index + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export function sqlStr(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

export function SqlQuery({ file, code }: { file: string; code: string }) {
  const lines = code.split('\n')
  return (
    <figure className="query" aria-label={`${file} (읽기 전용 쿼리)`}>
      <figcaption className="query-bar">
        <span className="query-dot" aria-hidden="true" />
        <span className="query-file">{file}</span>
        <span className="query-ro">읽기 전용</span>
      </figcaption>
      <div className="query-body">
        {lines.map((l, i) => (
          <div key={i} className="ql">
            <span className="qn" aria-hidden="true">
              {i + 1}
            </span>
            <code>{l ? highlight(l) : ' '}</code>
          </div>
        ))}
      </div>
    </figure>
  )
}

export function GridStatus({ rows, children }: { rows: number; children?: React.ReactNode }) {
  return (
    <p className="grid-status">
      <span className="gs-mark">▸</span> <span className="t-num">{rows}</span> rows
      {children ? <> · {children}</> : null}
    </p>
  )
}
