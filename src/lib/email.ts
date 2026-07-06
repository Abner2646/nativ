// src/lib/email.ts
import { Resend } from 'resend'
import { Reservation, TenantSettings } from '@/lib/types'

import { getAppDomain, getTenantBaseUrl } from '@/lib/domain'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM_DEV = 'onboarding@resend.dev'
const isDev = process.env.NODE_ENV === 'development'

function getFrom(settings: TenantSettings) {
  if (isDev) return FROM_DEV
  return `${settings.name} <reservations@${getAppDomain()}>`
}

function getTenantUrl(slug: string) {
  return getTenantBaseUrl(slug)
}

export async function sendConfirmationEmail(
  r: Reservation, settings: TenantSettings, slug: string,
  refundCutoffHours?: number
) {
  const cancelUrl = `${getTenantUrl(slug)}/cancel?token=${r.cancellation_token}`
  const guest = r.guest!
  const depositRow = r.deposit_amount
    ? `<tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Deposit</td><td>$${r.deposit_amount.toFixed(2)} paid</td></tr>`
    : ''
  const refundNote = r.deposit_amount && refundCutoffHours != null
    ? `<p style="font-size:13px;color:#666;">Free cancellation if cancelled at least <strong>${refundCutoffHours} hours</strong> before your reservation. After that, the deposit is non-refundable.</p>`
    : ''
  await resend.emails.send({
    from: getFrom(settings),
    to: guest.email,
    subject: `Reservation Confirmed — ${settings.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:${settings.primary_color}">Your reservation is confirmed!</h2>
        <p>Hi ${guest.name},</p>
        <p>We look forward to seeing you at <strong>${settings.name}</strong>.</p>
        <table style="width:100%">
          <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Date</td><td>${r.date}</td></tr>
          <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Time</td><td>${r.time}</td></tr>
          <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Guests</td><td>${r.party_size}</td></tr>
          ${r.occasion ? `<tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Occasion</td><td>${r.occasion}</td></tr>` : ''}
          ${r.notes ? `<tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Notes</td><td>${r.notes}</td></tr>` : ''}
          ${depositRow}
        </table>
        <br>
        ${refundNote}
        <p><a href="${cancelUrl}" style="color:${settings.primary_color}">Need to cancel? Click here.</a></p>
      </div>`
  })
}

export async function sendCancellationEmail(r: Reservation, settings: TenantSettings, refunded?: boolean) {
  const guest = r.guest!
  const refundLine = r.deposit_amount
    ? refunded
      ? `<p style="font-size:13px;color:#16a34a;">Your deposit of <strong>$${r.deposit_amount.toFixed(2)}</strong> has been refunded and will appear on your statement within a few business days.</p>`
      : `<p style="font-size:13px;color:#666;">Your deposit of <strong>$${r.deposit_amount.toFixed(2)}</strong> was not refunded as the cancellation was made within the refund cutoff window.</p>`
    : ''
  await resend.emails.send({
    from: getFrom(settings),
    to: guest.email,
    subject: `Reservation Cancelled — ${settings.name}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Reservation Cancelled</h2>
      <p>Hi ${guest.name}, your reservation for ${r.date} at ${r.time} has been cancelled.</p>
      ${refundLine}
      <p>We hope to see you another time!</p>
    </div>`
  })
}

export async function sendOwnerNotification(r: Reservation, settings: TenantSettings) {
  const guest = r.guest!
  await resend.emails.send({
    from: getFrom(settings),
    to: settings.notification_email,
    subject: `New Reservation — ${guest.name} (${r.date} ${r.time})`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>New reservation received</h2>
      <table style="width:100%">
        <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Guest</td><td>${guest.name}</td></tr>
        <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Email</td><td>${guest.email}</td></tr>
        <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Phone</td><td>${guest.phone ?? '—'}</td></tr>
        <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Date</td><td>${r.date}</td></tr>
        <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Time</td><td>${r.time}</td></tr>
        <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Guests</td><td>${r.party_size}</td></tr>
        ${r.occasion ? `<tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Occasion</td><td>${r.occasion}</td></tr>` : ''}
        ${r.notes ? `<tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:4px 0">Notes</td><td>${r.notes}</td></tr>` : ''}
      </table>
    </div>`
  })
}

export async function sendEmployeeInvite(email: string, token: string, restaurantName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const inviteUrl = `${appUrl}/invite?token=${token}`
  const { error } = await resend.emails.send({
    from: isDev ? FROM_DEV : `${restaurantName} <noreply@${getAppDomain()}>`,
    to: email,
    subject: `You've been invited to ${restaurantName} on Nativ`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>You're invited!</h2>
      <p>${restaurantName} has invited you to manage reservations on Nativ.</p>
      <p><a href="${inviteUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">Accept invitation</a></p>
      <p style="color:#888;font-size:12px">This link expires in 7 days.</p>
    </div>`
  })
  if (error) throw error
}

export async function sendBirthdayEmail(
  guestEmail: string, guestName: string,
  settings: TenantSettings, slug: string,
  subject: string, body: string
) {
  const reserveUrl = `${getTenantUrl(slug)}/reserve`
  const html = body
    .replace(/\{guest_name\}/g, guestName)
    .replace(/\{restaurant_name\}/g, settings.name)
    .replace(/\{reserve_url\}/g, reserveUrl)

  await resend.emails.send({
    from: getFrom(settings),
    to: guestEmail,
    subject: subject.replace(/\{restaurant_name\}/g, settings.name),
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">${html}</div>`
  })
}

export async function sendCampaignEmail(
  guestEmail: string, settings: TenantSettings,
  subject: string, body: string
) {
  await resend.emails.send({
    from: getFrom(settings),
    to: guestEmail,
    subject,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">${body}</div>`
  })
}

export async function sendReminderEmail(r: Reservation, settings: TenantSettings, slug: string) {
  const guest = r.guest!
  const cancelUrl = `${getTenantUrl(slug)}/cancel?token=${r.cancellation_token}`
  await resend.emails.send({
    from: getFrom(settings),
    to: guest.email,
    subject: `Reminder: Your reservation tomorrow at ${settings.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:${settings.primary_color}">See you tomorrow!</h2>
        <p>Hi ${guest.name},</p>
        <p>Just a reminder about your reservation at <strong>${settings.name}</strong>.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:6px 0">Date</td><td>${r.date}</td></tr>
          <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:6px 0">Time</td><td>${r.time}</td></tr>
          <tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:6px 0">Guests</td><td>${r.party_size}</td></tr>
          ${r.occasion ? `<tr><td style="color:#888;font-size:12px;text-transform:uppercase;padding:6px 0">Occasion</td><td>${r.occasion}</td></tr>` : ''}
        </table>
        <br>
        <p>We look forward to seeing you!</p>
        <p><a href="${cancelUrl}" style="color:${settings.primary_color}">Need to cancel? Click here.</a></p>
      </div>`
  })
}
