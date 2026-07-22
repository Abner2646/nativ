import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBirthdayEmail } from '@/lib/email'
import { BirthdayCampaignConfig, TenantSettings } from '@/lib/types'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: configs, error: configError } = await supabaseAdmin
    .from('birthday_campaign_config')
    .select('*')
    .eq('is_enabled', true)

  if (configError) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  if (!configs?.length) return NextResponse.json({ sent: 0 })

  const now = new Date()
  let sent = 0

  await Promise.allSettled(
    (configs as BirthdayCampaignConfig[]).map(async (config) => {
      // The birthday window opens `days_before` days before the birthday.
      // Guests created AFTER that window opened may have had their birthday
      // data entered while the restaurant hasn't even met them yet —
      // e.g., someone books 8 days out and their birthday happens to be in 7 days.
      // Guard: only send to guests whose record predates the window opening.
      const windowOpenedAt = new Date(now)
      windowOpenedAt.setUTCDate(windowOpenedAt.getUTCDate() - config.days_before)

      // Target birthday = today + days_before (month + day match)
      const birthdayTarget = new Date(now)
      birthdayTarget.setUTCDate(birthdayTarget.getUTCDate() + config.days_before)
      const targetBdMonth = birthdayTarget.getUTCMonth() + 1
      const targetBdDay = birthdayTarget.getUTCDate()

      const { data: guests } = await supabaseAdmin
        .from('guests')
        .select('id, email, name, birthday, created_at')
        .eq('tenant_id', config.tenant_id)
        .not('birthday', 'is', null)
        .lt('created_at', windowOpenedAt.toISOString())

      if (!guests?.length) return

      const birthdayGuests = guests.filter(g => {
        // Parse YYYY-MM-DD directly to avoid UTC vs local timezone ambiguity
        const [, month, day] = (g.birthday as string).split('-').map(Number)
        return month === targetBdMonth && day === targetBdDay
      })

      if (!birthdayGuests.length) return

      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('slug, tenant_settings(*)')
        .eq('id', config.tenant_id)
        .single()

      if (!tenantData) return
      const settings = (tenantData.tenant_settings as unknown as TenantSettings[])?.[0]
      if (!settings) return

      await Promise.allSettled(
        birthdayGuests.map(async (guest) => {
          await sendBirthdayEmail(
            guest.email,
            guest.name,
            settings,
            tenantData.slug,
            config.email_subject,
            config.email_body
          )
          sent++
        })
      )
    })
  )

  return NextResponse.json({ sent })
}
