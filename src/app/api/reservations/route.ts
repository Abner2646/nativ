// src/app/api/reservations/route.ts
import { NextRequest } from 'next/server'
import { createReservation, cancelReservation } from '@/routes/reservations.routes'
export const POST = (req: NextRequest) => {
  const action = new URL(req.url).searchParams.get('action')
  return action === 'cancel' ? cancelReservation(req) : createReservation(req)
}
