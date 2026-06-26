// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    // La respuesta se crea primero para que el cliente escriba las cookies en ella
    const redirectResponse = NextResponse.redirect(`${origin}${next}`)
    const supabase = createRouteHandlerSupabase(req, redirectResponse)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}