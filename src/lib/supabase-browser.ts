import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — createBrowserClient is safe to call once at module level
let client: ReturnType<typeof createBrowserClient> | null = null

export function getBrowserSupabase() {
  if (!client) client = createBrowserClient(url, anon)
  return client
}
