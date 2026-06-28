import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis: Redis | null =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

function makeLimiter(count: number, window: string, prefix: string): Ratelimit | null {
  if (!redis) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(count, window as any), prefix })
}

// 60 checks/min per IP — calendar browsing
export const availabilityLimiter = makeLimiter(60, '1 m', 'rl:avail')

// 10 reservations/min per IP — prevents booking spam
export const reservationLimiter = makeLimiter(10, '1 m', 'rl:reserve')

// 3 accounts/hour per IP — prevents bulk signup
export const registerLimiter = makeLimiter(3, '1 h', 'rl:reg')

export async function checkRateLimit(
  rl: Ratelimit | null,
  identifier: string,
): Promise<{ limited: boolean; headers: Record<string, string> }> {
  if (!rl) return { limited: false, headers: {} }
  const { success, limit, remaining, reset } = await rl.limit(identifier)
  return {
    limited: !success,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(reset),
    },
  }
}
