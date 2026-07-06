import { supabaseAdmin } from '@/lib/supabase'
import { buildTheme } from '@/lib/theme'
import { CancelClient } from './CancelClient'

function StaticPage({ message }: { message: string }) {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#111015', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <p style={{ color: 'rgba(242,239,233,0.45)', fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', textAlign: 'center' }}>
        {message}
      </p>
    </main>
  )
}

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) return <StaticPage message="Invalid cancellation link." />

  const { data: reservation } = await supabaseAdmin
    .from('reservations')
    .select('id, date, time, party_size, status, tenant_id, guest:guests(name, email)')
    .eq('cancellation_token', token)
    .maybeSingle()

  if (!reservation)          return <StaticPage message="Reservation not found." />
  if (reservation.status === 'cancelled') return <StaticPage message="This reservation has already been cancelled." />
  if (reservation.status === 'completed') return <StaticPage message="This reservation has already been completed and cannot be cancelled." />

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('name, background_color, primary_color, secondary_color, font_family, button_style')
    .eq('tenant_id', reservation.tenant_id)
    .maybeSingle()

  const theme = buildTheme(settings ?? {})
  const guest = (Array.isArray(reservation.guest) ? reservation.guest[0] : reservation.guest) as { name: string; email: string } | null

  return (
    <CancelClient
      token={token}
      reservation={{
        date:       reservation.date,
        time:       reservation.time,
        party_size: reservation.party_size,
        guestName:  guest?.name  ?? '',
        guestEmail: guest?.email ?? '',
      }}
      restaurantName={settings?.name ?? ''}
      theme={theme}
    />
  )
}
