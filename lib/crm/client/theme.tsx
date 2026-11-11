'use client'

// 블랙 / 화이트 테마 전환 (v1~v10 공통).
// <html data-theme="dark|light"> 로 표시하고, 각 스킨의 theme.css(블랙)·theme-light.css(화이트)가 그에 맞춰 칠한다.
// 고른 테마는 이 브라우저에 저장된다(새로고침·다시 로그인해도 유지). 기본값은 블랙.

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
export const THEME_STORAGE_KEY = 'ycrm_theme'

// 화면이 그려지기 전에 테마를 정해 깜빡임을 막는 스크립트(루트 레이아웃 <head>에 넣는다)
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}`

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {}
  window.dispatchEvent(new CustomEvent('ycrm-theme', { detail: theme }))
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  useEffect(() => {
    setTheme(readTheme())
    const onChange = (e: Event) => setTheme((e as CustomEvent<Theme>).detail)
    window.addEventListener('ycrm-theme', onChange)
    return () => window.removeEventListener('ycrm-theme', onChange)
  }, [])
  const toggle = useCallback(() => applyTheme(readTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle, setTheme: applyTheme }
}

// 오른쪽 위에 두는 전환 버튼. 모양은 스킨마다 className 으로 꾸민다.
// 지금이 블랙이면 "화이트" 로, 화이트면 "블랙" 으로 바꾸는 버튼이다.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? '화이트' : '블랙'
  return (
    <button type="button" className={`theme-toggle ${className}`.trim()} onClick={toggle} aria-label={`${next} 테마로 바꾸기`} title={`${next} 테마로 바꾸기`} data-theme-now={theme}>
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === 'dark' ? '☀' : '☾'}
      </span>
      <span className="theme-toggle-label">{next}</span>
    </button>
  )
}
