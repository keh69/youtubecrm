'use client'

import { useSession } from '@/lib/crm/client/hooks'

// ───────────────────────── 스킨 모양 사전 ─────────────────────────
// 공용 부품(components/*)이 각 스킨의 원래 class 이름을 그대로 쓰게 해서, 같은 부품이 어느 스킨에서나 그 스킨답게 보이게 한다.
// → 기능·글자·열 순서는 공용 부품 한 곳만 고치면 11개 스킨에 모두 적용되고, 스킨 디자인은 그대로 유지된다.
// 새 스킨 부품 모양이 필요하면 여기 한 줄씩만 더하면 된다.

export type SkinUi = {
  section: string // 카드(구역)
  h2: string // 구역 제목
  field: string // 라벨+입력칸 묶음(스킨 CSS가 이 안의 input/select 를 꾸민다)
  input: string // 입력칸에 직접 붙는 class(없는 스킨은 field 안에서 꾸며진다)
  btn: string // 보통 버튼(작게)
  btnPrimary: string // 강조 버튼(작게)
  btnDanger: string // 위험(삭제) 버튼(작게)
  tableWrap: string
  table: string
  chip: string
  muted: string
  msgOk: string
  msgErr: string
}

const CLASSIC: SkinUi = {
  section: 'card',
  h2: '',
  field: 'field',
  input: '',
  btn: 'btn ghost small',
  btnPrimary: 'btn primary small',
  btnDanger: 'btn ghost small danger-text',
  tableWrap: 'table-wrap',
  table: 'table',
  chip: 'chip',
  muted: 'muted small',
  msgOk: 'msg ok',
  msgErr: 'msg error'
}

export const SKIN_UI: Record<string, SkinUi> = {
  v1: CLASSIC,
  v2: {
    section: 'panel',
    h2: 'sect',
    field: 'fld',
    input: '',
    btn: 'key ghost sm',
    btnPrimary: 'key accent sm',
    btnDanger: 'key ghost sm danger-text',
    tableWrap: 'tbl-wrap',
    table: 'tbl',
    chip: 'chip',
    muted: 'muted small',
    msgOk: 'note good',
    msgErr: 'note bad'
  },
  v3: {
    section: 'j-section',
    h2: 'j-h2',
    field: 'j-field',
    input: '',
    btn: 'j-btn plain small',
    btnPrimary: 'j-btn ink small',
    btnDanger: 'j-textbtn danger',
    tableWrap: 'j-table-wrap',
    table: 'j-table',
    chip: 'j-tag',
    muted: 'j-muted',
    msgOk: 'j-note ok',
    msgErr: 'j-note error'
  },
  v4: {
    section: 'blk',
    h2: 'blk-title bg-blue',
    field: 'field',
    input: '',
    btn: 'btn white sm',
    btnPrimary: 'btn mint sm',
    btnDanger: 'btn red sm',
    tableWrap: 'tbl-wrap',
    table: 'tbl',
    chip: 'chip',
    muted: 'muted small',
    msgOk: 'msg msg-ok',
    msgErr: 'msg msg-error'
  },
  v5: {
    section: 'g-glass',
    h2: 'g-h2',
    field: 'g-field',
    input: 'g-input',
    btn: 'g-btn ghost sm',
    btnPrimary: 'g-btn primary sm',
    btnDanger: 'g-btn soft-danger sm',
    tableWrap: 'g-table-wrap',
    table: 'g-table',
    chip: 'g-chip accent',
    muted: 'g-muted g-small',
    msgOk: 'g-msg ok',
    msgErr: 'g-msg error'
  },
  v6: CLASSIC,
  v7: CLASSIC,
  v8: CLASSIC,
  v9: CLASSIC,
  v10: CLASSIC,
  v11: CLASSIC
}

export function skinKeyFromBase(base: string) {
  const m = /^\/(v\d+)/.exec(base || '')
  return m ? m[1] : 'v1' // v1 은 주소 앞에 /v1 이 없다
}

// 지금 화면의 스킨 모양. 세션 밖(로그인 화면 등)에서는 기본 모양.
export function useSkinUi(): SkinUi & { key: string } {
  let base = ''
  try {
    base = useSession().base
  } catch {
    base = ''
  }
  const key = skinKeyFromBase(base)
  return { key, ...(SKIN_UI[key] || CLASSIC) }
}

// 여러 class 를 빈칸 없이 합치기
export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ')
