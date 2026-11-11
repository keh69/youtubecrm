'use client'

import { useState } from 'react'

// 설정 → 01 사원목록: 새 직원에게 보낼 "직원양식"을 클립보드에 복사하는 버튼 (모든 스킨 공통)
export const EMPLOYEE_FORM_TEXT = `희망아이디:
이름:
전화번호:
이메일:

※ 첫 비밀번호는 아이디와 동일
※ 내정보에서 비밀번호 수정 가능.`

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

export function CopyEmployeeFormButton({ className = '' }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  const onClick = async () => {
    const ok = await copyText(EMPLOYEE_FORM_TEXT)
    setState(ok ? 'ok' : 'fail')
    window.setTimeout(() => setState('idle'), 2200)
  }
  return (
    <button type="button" className={`copy-form-btn ${className}`.trim()} onClick={onClick} title={EMPLOYEE_FORM_TEXT} aria-live="polite">
      {state === 'ok' ? '✓ 복사했습니다' : state === 'fail' ? '복사하지 못했습니다' : '📋 직원양식 복사'}
    </button>
  )
}
