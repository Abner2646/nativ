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
  const depositLine = r.deposit_amount
    ? `Deposit: $${r.deposit_amount.toFixed(2)} paid`
    : ''
  const depositRow = r.deposit_amount
    ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0 5px;padding-right:24px">Deposit</td><td style="padding:5px 0">$${r.deposit_amount.toFixed(2)} paid</td></tr>`
    : ''
  const occasionRow = r.occasion
    ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Occasion</td><td style="padding:5px 0">${r.occasion}</td></tr>`
    : ''
  const notesRow = r.notes
    ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Notes</td><td style="padding:5px 0">${r.notes}</td></tr>`
    : ''

  await resend.emails.send({
    from: getFrom(settings),
    to: guest.email,
    subject: `Reservation confirmed at ${settings.name}`,
    text: [
      `Hi ${guest.name},`,
      ``,
      `Your reservation at ${settings.name} is confirmed.`,
      ``,
      `Date: ${r.date}`,
      `Time: ${r.time}`,
      `Guests: ${r.party_size}`,
      r.occasion ? `Occasion: ${r.occasion}` : '',
      r.notes    ? `Notes: ${r.notes}`       : '',
      depositLine,
      ``,
      `If you need to cancel, visit: ${cancelUrl}`,
      ``,
      `We look forward to seeing you.`,
      `${settings.name}`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#222;line-height:1.5">
        <p style="font-size:20px;font-weight:bold;margin-bottom:4px">Reservation confirmed</p>
        <p style="color:#555;margin-top:0">Hi ${guest.name}, we look forward to seeing you at <strong>${settings.name}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Date</td><td style="padding:5px 0">${r.date}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Time</td><td style="padding:5px 0">${r.time}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Guests</td><td style="padding:5px 0">${r.party_size}</td></tr>
          ${occasionRow}
          ${notesRow}
          ${depositRow}
        </table>
        <p style="font-size:13px;color:#666;margin-top:20px">
          Need to cancel? Visit the link below:<br>
          <a href="${cancelUrl}" style="color:#444;word-break:break-all">${cancelUrl}</a>
        </p>
      </div>`,
  })
}

export async function sendCancellationEmail(r: Reservation, settings: TenantSettings, refunded?: boolean) {
  const guest = r.guest!
  const refundText = r.deposit_amount
    ? refunded
      ? `Your deposit of $${r.deposit_amount.toFixed(2)} has been refunded and will appear on your statement within a few business days.`
      : `Your deposit of $${r.deposit_amount.toFixed(2)} was not refunded as the cancellation was made within the cutoff window.`
    : ''
  const refundHtml = r.deposit_amount
    ? refunded
      ? `<p style="font-size:13px;color:#16a34a;">${refundText}</p>`
      : `<p style="font-size:13px;color:#666;">${refundText}</p>`
    : ''

  await resend.emails.send({
    from: getFrom(settings),
    to: guest.email,
    subject: `Reservation cancelled — ${settings.name}`,
    text: [
      `Hi ${guest.name},`,
      ``,
      `Your reservation at ${settings.name} on ${r.date} at ${r.time} has been cancelled.`,
      refundText,
      ``,
      `We hope to see you again soon.`,
      `${settings.name}`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#222;line-height:1.5">
        <p style="font-size:18px;font-weight:bold">Reservation cancelled</p>
        <p>Hi ${guest.name}, your reservation at <strong>${settings.name}</strong> on ${r.date} at ${r.time} has been cancelled.</p>
        ${refundHtml}
        <p style="color:#555">We hope to see you again soon.</p>
      </div>`,
  })
}

export async function sendOwnerNotification(r: Reservation, settings: TenantSettings, slug: string) {
  const guest = r.guest!
  const cancelUrl = `${getTenantUrl(slug)}/cancel?token=${r.cancellation_token}`
  await resend.emails.send({
    from: getFrom(settings),
    to: settings.notification_email,
    subject: `New reservation — ${guest.name} (${r.date} ${r.time})`,
    text: [
      `New reservation received.`,
      ``,
      `Guest: ${guest.name}`,
      `Email: ${guest.email}`,
      `Phone: ${guest.phone ?? '—'}`,
      `Date: ${r.date}`,
      `Time: ${r.time}`,
      `Guests: ${r.party_size}`,
      r.occasion       ? `Occasion: ${r.occasion}` : '',
      r.notes          ? `Notes: ${r.notes}` : '',
      r.deposit_amount ? `Deposit: $${r.deposit_amount.toFixed(2)} paid` : '',
      ``,
      `Guest cancel link: ${cancelUrl}`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#222;line-height:1.5">
        <p style="font-size:18px;font-weight:bold">New reservation received</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Guest</td><td style="padding:5px 0">${guest.name}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Email</td><td style="padding:5px 0">${guest.email}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Phone</td><td style="padding:5px 0">${guest.phone ?? '—'}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Date</td><td style="padding:5px 0">${r.date}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Time</td><td style="padding:5px 0">${r.time}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Guests</td><td style="padding:5px 0">${r.party_size}</td></tr>
          ${r.occasion ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Occasion</td><td style="padding:5px 0">${r.occasion}</td></tr>` : ''}
          ${r.notes ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Notes</td><td style="padding:5px 0">${r.notes}</td></tr>` : ''}
          ${r.deposit_amount ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Deposit</td><td style="padding:5px 0">$${r.deposit_amount.toFixed(2)} paid</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;font-size:13px;color:#666;">
          Guest cancel link:<br>
          <a href="${cancelUrl}" style="color:#444;word-break:break-all">${cancelUrl}</a>
        </p>
      </div>`,
  })
}

export async function sendEmployeeInvite(email: string, token: string, restaurantName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const inviteUrl = `${appUrl}/invite?token=${token}`
  const { error } = await resend.emails.send({
    from: isDev ? FROM_DEV : `${restaurantName} <noreply@${getAppDomain()}>`,
    to: email,
    subject: `Invitation to join ${restaurantName} on Nativ`,
    text: [
      `You have been invited to manage reservations for ${restaurantName} on Nativ.`,
      ``,
      `To accept, visit: ${inviteUrl}`,
      ``,
      `This link expires in 7 days.`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#222;line-height:1.5">
        <p style="font-size:18px;font-weight:bold">You have been invited</p>
        <p>${restaurantName} has invited you to manage reservations on Nativ.</p>
        <p style="margin:20px 0">
          <a href="${inviteUrl}" style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-size:14px">Accept invitation</a>
        </p>
        <p style="color:#888;font-size:12px">Or copy this link: <span style="color:#444">${inviteUrl}</span></p>
        <p style="color:#888;font-size:12px">This link expires in 7 days.</p>
      </div>`,
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
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto">${html}</div>`,
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
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto">${body}</div>`,
  })
}

export async function sendReminderEmail(r: Reservation, settings: TenantSettings, slug: string) {
  const guest = r.guest!
  const cancelUrl = `${getTenantUrl(slug)}/cancel?token=${r.cancellation_token}`
  const occasionRow = r.occasion
    ? `<tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Occasion</td><td style="padding:5px 0">${r.occasion}</td></tr>`
    : ''

  await resend.emails.send({
    from: getFrom(settings),
    to: guest.email,
    subject: `Reminder: your reservation tomorrow at ${settings.name}`,
    text: [
      `Hi ${guest.name},`,
      ``,
      `This is a reminder about your reservation at ${settings.name} tomorrow.`,
      ``,
      `Date: ${r.date}`,
      `Time: ${r.time}`,
      `Guests: ${r.party_size}`,
      r.occasion ? `Occasion: ${r.occasion}` : '',
      ``,
      `We look forward to seeing you.`,
      ``,
      `Need to cancel? Visit: ${cancelUrl}`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#222;line-height:1.5">
        <p style="font-size:20px;font-weight:bold;margin-bottom:4px">See you tomorrow!</p>
        <p style="color:#555;margin-top:0">Hi ${guest.name}, this is a reminder about your reservation at <strong>${settings.name}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Date</td><td style="padding:5px 0">${r.date}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Time</td><td style="padding:5px 0">${r.time}</td></tr>
          <tr><td style="color:#777;font-size:12px;text-transform:uppercase;padding:5px 0;padding-right:24px">Guests</td><td style="padding:5px 0">${r.party_size}</td></tr>
          ${occasionRow}
        </table>
        <p style="color:#555">We look forward to seeing you.</p>
        <p style="font-size:13px;color:#666;margin-top:20px">
          Need to cancel? Visit the link below:<br>
          <a href="${cancelUrl}" style="color:#444;word-break:break-all">${cancelUrl}</a>
        </p>
      </div>`,
  })
}
