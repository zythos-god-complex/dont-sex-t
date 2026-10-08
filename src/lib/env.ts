// Typed access to the public client config. Fallbacks are the public values from SPEC.md
// so a missing env var never bricks the app.
const env = import.meta.env as Record<string, string | undefined>

export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL || 'https://afxnqxxntxfawcgxmyac.supabase.co').replace(/\/+$/, '')
export const SUPABASE_KEY: string = env.VITE_SUPABASE_KEY || 'sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'
export const VAPID_PUBLIC_KEY: string =
  env.VITE_VAPID_PUBLIC_KEY ||
  'BJg6GPhZEyOprJNso1yn69QiozHlQOSJaTi1nK69MPieD6PkWsht3kZTCqhvrBk5M-ChP2FmE399W8X2y4266hU'

export const REALTIME_URL = `${SUPABASE_URL}/realtime/v1`
export const REST_URL = `${SUPABASE_URL}/rest/v1`
export const IS_DEV = !!import.meta.env.DEV
