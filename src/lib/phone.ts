// Normalización de teléfonos a E.164 (US) — pura y testeable.

export function e164(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}
