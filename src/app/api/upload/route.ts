// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadImage, deleteImage } from '@/lib/cloudinary'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type')
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    if (type === 'logo') {
      const { url } = await uploadImage(buffer, ctx.tenant.slug, `${ctx.tenant.slug}-logo`)
      await supabaseAdmin.from('tenant_settings').update({ logo_url: url }).eq('tenant_id', ctx.tenant.id)
      return NextResponse.json({ url })
    }

    if (type === 'photo') {
      const { url } = await uploadImage(buffer, `${ctx.tenant.slug}/photos`, `photo-${Date.now()}`)
      const { data: last } = await supabaseAdmin.from('tenant_photos').select('position').eq('tenant_id', ctx.tenant.id).order('position', { ascending: false }).limit(1)
      const position = last && last.length > 0 ? last[0].position + 1 : 0
      const { data: photo } = await supabaseAdmin.from('tenant_photos').insert({ tenant_id: ctx.tenant.id, url, position }).select().single()
      return NextResponse.json({ photo }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: photo } = await supabaseAdmin.from('tenant_photos').select('url').eq('id', id).eq('tenant_id', ctx.tenant.id).maybeSingle()
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const publicId = photo.url.split('/upload/')[1]?.split('.')[0]
  if (publicId) await deleteImage(publicId).catch(console.error)
  await supabaseAdmin.from('tenant_photos').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
