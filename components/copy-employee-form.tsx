'use client'

import { useEffect, useState } from 'react'

// 설정 → 01 사원목록: "직원양식 [편집] [복사]" (모든 스킨 공통)
// - [편집]: 양식 글을 고친다(이 컴퓨터에 저장). 기본값으로 되돌릴 수 있다.
// - [복사]: 지금 양식을 클립보드에 복사한다.
export const EMPLOYEE_FORM_TEXT = `희망아이디:
이름:
전화번호:
이메일:

※ 첫 비밀번호는 아이디와 동일
※ 내정보에서 비밀번호 수정 가능.`

const STORAGE_KEY = 'ycrm_employee_form'

function loadForm() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || EMPLOYEE_FORM_TEXT
  } catch {
    return EMPLOYEE_FORM_TEXT
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 클립보드 권한이 없는 환경을 위한 예전 방식
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function CopyEmployeeFormButton() {
  const [form, setForm] = useState(EMPLOYEE_FORM_TEXT)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

  useEffect(() => setForm(loadForm()), [])

  const copy = async () => {
    const ok = await copyText(form)
    setCopied(ok ? 'ok' : 'fail')
    window.setTimeout(() => setCopied('idle'), 2000)
  }
  const startEdit = () => {
    setDraft(form)
    setEditing(true)
  }
  const save = () => {
    const text = draft.trim() ? draft : EMPLOYEE_FORM_TEXT
    setForm(text)
    try {
      if (text === EMPLOYEE_FORM_TEXT) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, text)
    } catch {}
    setEditing(false)
  }

  return (
    <div className="copy-form">
      <div className="copy-form-tools">
        <span className="copy-form-label">직원양식</span>
        <button type="button" className={`copy-form-btn${editing ? ' on' : ''}`} onClick={() => (editing ? setEditing(false) : startEdit())} aria-expanded={editing}>
          편집
        </button>
        <button type="button" className="copy-form-btn primary" onClick={copy} title={form} aria-live="polite">
          {copied === 'ok' ? '✓ 복사됨' : copied === 'fail' ? '복사 실패' : '복사'}
        </button>
      </div>
      {editing && (
        <div className="copy-form-editor">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} aria-label="직원양식 내용" />
          <div className="copy-form-editor-actions">
            <span className="copy-form-hint">이 컴퓨터에 저장됩니다.</span>
            <button type="button" className="copy-form-btn" onClick={() => setDraft(EMPLOYEE_FORM_TEXT)}>
              기본값으로
            </button>
            <button type="button" className="copy-form-btn" onClick={() => setEditing(false)}>
              취소
            </button>
            <button type="button" className="copy-form-btn primary" onClick={save}>
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
