// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const loginResponse = NextResponse.redirect(new URL('/login', req.url))
  const supabase = createRouteHandlerSupabase(req, loginResponse)
  await supabase.auth.signOut()
  return loginResponse
}
