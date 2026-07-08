// Lógica pura de turn times — separada de las rutas para poder testearla
// sin arrastrar clientes de Supabase/Twilio que exigen env vars al importar.

export interface TurnTimeRule {
  max_party: number
  duration_minutes: number
}

// Duración resuelta para un party: primera regla cuyo max_party lo cubre,
// fallback a la duración del shift.
export function resolveDuration(
  rules: TurnTimeRule[] | null | undefined,
  partySize: number,
  shiftDuration: number
): number {
  const sorted = [...(rules || [])].sort((a, b) => a.max_party - b.max_party)
  const match = sorted.find(r => r.max_party >= partySize)
  return match?.duration_minutes ?? shiftDuration
}
