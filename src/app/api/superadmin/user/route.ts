import { NextRequest, NextResponse } from 'next/server'
import { getUser, getProfile } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function verifySuperadmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_superadmin) return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await verifySuperadmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('id')
  const action = req.nextUrl.searchParams.get('action')

  if (!userId || action !== 'toggle_superadmin') {
    return NextResponse.json({ error: 'Missing id or unknown action' }, { status: 400 })
  }

  // No permitir que un superadmin se quite el rol a sí mismo
  if (userId === admin.id) {
    return NextResponse.json({ error: 'Cannot modify your own superadmin status' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_superadmin')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const newValue = !profile.is_superadmin
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_superadmin: newValue })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  return NextResponse.json({ is_superadmin: newValue })
}
