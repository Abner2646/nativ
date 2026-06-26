// src/app/api/availability/route.ts
import { NextRequest } from 'next/server'
import { getAvailability } from '@/routes/availability.routes'
export const GET = (req: NextRequest) => getAvailability(req)
