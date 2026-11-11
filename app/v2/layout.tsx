import './theme.css'
import './theme-light.css'

// v2 · Night Console — 어두운 관제 콘솔. 시안(cyan) 포인트, 숫자는 모두 고정폭(IBM Plex Mono).
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"
        precedence="default"
      />
      <div className="v2">
        {children}
      </div>
    </>
  )
}
