import { requireUser, getTenantBySlug } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { EmbedClient } from '@/components/admin/EmbedClient'

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Embed & share</h1>
      <p className="text-sm text-gray-500 mb-8">Let guests book directly from your website or any link.</p>
      <EmbedClient slug={slug} />
    </div>
  )
}
