import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { PhotosClient } from '@/components/admin/PhotosClient'
import { TenantPhoto } from '@/lib/types'

export default async function PhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await requireAdminForSlug(slug, user.id)

  const { tenant } = access

  const [{ data: settings }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('tenant_settings').select('logo_url').eq('tenant_id', tenant.id).single(),
    supabaseAdmin.from('tenant_photos').select('*').eq('tenant_id', tenant.id).order('position'),
  ])

  return (
    <div className="p-8">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-8">Photos</h1>
      <PhotosClient
        slug={slug}
        initialLogo={settings?.logo_url ?? null}
        initialPhotos={(photos as TenantPhoto[]) || []}
      />
    </div>
  )
}
