// src/lib/sms.ts
import twilio from 'twilio'
import { Reservation, TenantSettings } from '@/lib/types'

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
const FROM = process.env.TWILIO_PHONE_NUMBER!

function e164(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}

export async function sendConfirmationSMS(r: Reservation, settings: TenantSettings) {
  const guest = r.guest!
  if (!guest.phone) return
  await client.messages.create({
    from: FROM,
    to: e164(guest.phone),
    body: `${settings.name}: Reservation confirmed for ${r.date} at ${r.time} (${r.party_size} guests).`
  })
}

export async function sendReminderSMS(r: Reservation, settings: TenantSettings) {
  const guest = r.guest!
  if (!guest.phone) return
  await client.messages.create({
    from: FROM,
    to: e164(guest.phone),
    body: `${settings.name}: Reminder — your table is tomorrow, ${r.date} at ${r.time}. See you soon!`
  })
}
