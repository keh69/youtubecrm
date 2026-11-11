'use client'

import { useSession } from '@/lib/crm/client/hooks'

// v8 · 터미널 — 각 화면 맨 위의 프롬프트 한 줄. `아이디@crm:~$ 명령` + 깜빡이는 커서.
export function PromptLine({ user, cmd }: { user: string; cmd: string }) {
  return (
    <p className="prompt" aria-hidden="true">
      <span className="p-user">{user}@crm</span>
      <span className="p-sep">:</span>
      <span className="p-path">~</span>
      <span className="p-sep">$ </span>
      <span className="p-cmd">{cmd}</span>
      <span className="cursor" />
    </p>
  )
}

export function Prompt({ cmd }: { cmd: string }) {
  const { me } = useSession()
  return <PromptLine user={me.loginId} cmd={cmd} />
}
