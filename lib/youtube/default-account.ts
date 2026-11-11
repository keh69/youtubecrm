import { DEFAULT_YOUTUBE_ACCOUNT_NAME, DEFAULT_YOUTUBE_API_KEY } from '@/lib/app-config'
import { TABLES } from '@/lib/supabase/tables'

// 서버 전용. YouTube API 키는 DB(youtubeCRM_youtube_accounts)에만 저장되어 있고
// git 저장소에는 들어가지 않는다. 키를 클라이언트 응답에 절대 싣지 말 것.

const SELECT_FIELDS = 'id, account_name, api_key, channel_id, channel_name, is_active, api_active'

export type YoutubeAccount = {
  id: string
  account_name: string
  api_key: string | null
  channel_id: string | null
  channel_name: string | null
  is_active: boolean
  api_active: boolean
}

export async function ensureDefaultYoutubeAccount(supabaseAdmin: any): Promise<YoutubeAccount> {
  const { data: existing, error } = await supabaseAdmin
    .from(TABLES.youtubeAccounts)
    .select(SELECT_FIELDS)
    .eq('account_name', DEFAULT_YOUTUBE_ACCOUNT_NAME)
    .maybeSingle()
  if (error) throw error

  if (existing) {
    // DB에 키가 비어 있을 때만 환경변수(YOUTUBE_API_KEY) 키로 채운다. 이미 등록된 키는 덮어쓰지 않는다.
    if (!String(existing.api_key || '').trim() && DEFAULT_YOUTUBE_API_KEY) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from(TABLES.youtubeAccounts)
        .update({ api_key: DEFAULT_YOUTUBE_API_KEY, is_active: true, api_active: true, api_last_error: null })
        .eq('id', existing.id)
        .select(SELECT_FIELDS)
        .single()
      if (updateError) throw updateError
      return updated
    }
    return existing
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from(TABLES.youtubeAccounts)
    .insert({
      account_name: DEFAULT_YOUTUBE_ACCOUNT_NAME,
      api_key: DEFAULT_YOUTUBE_API_KEY,
      is_active: true,
      api_active: Boolean(DEFAULT_YOUTUBE_API_KEY)
    })
    .select(SELECT_FIELDS)
    .single()
  if (createError) throw createError
  return created
}

export async function getActiveYoutubeKey(supabaseAdmin: any): Promise<{ account: YoutubeAccount; apiKey: string | null }> {
  const account = await ensureDefaultYoutubeAccount(supabaseAdmin)
  const apiKey = account.api_active ? String(account.api_key || '').trim() || null : null
  return { account, apiKey }
}
