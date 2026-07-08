// src/lib/sms.ts
import twilio from 'twilio'
import { Reservation, TenantSettings } from '@/lib/types'

import { e164 } from '@/lib/phone'

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
const FROM = process.env.TWILIO_PHONE_NUMBER!

export async function sendConfirmationSMS(r: Reservation, settings: TenantSettings) {
  const guest = r.guest!
  if (!guest.phone) return
  await client.messages.create({
    from: FROM,
    to: e164(guest.phone),
    body: `${settings.name}: Reservation confirmed for ${r.date} at ${r.time} (${r.party_size} guests). Reply STOP to opt out.`
  })
}

export async function sendReminderSMS(r: Reservation, settings: TenantSettings) {
  const guest = r.guest!
  if (!guest.phone) return
  await client.messages.create({
    from: FROM,
    to: e164(guest.phone),
    body: `${settings.name}: Reminder — your table is tomorrow, ${r.date} at ${r.time}. See you soon! Reply STOP to opt out.`
  })
}
