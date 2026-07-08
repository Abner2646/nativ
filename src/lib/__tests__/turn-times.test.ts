import { describe, it, expect } from 'vitest'
import { resolveDuration } from '@/lib/turn-times'

const rules = [
  { max_party: 2, duration_minutes: 60 },
  { max_party: 4, duration_minutes: 90 },
  { max_party: 8, duration_minutes: 120 },
]

describe('resolveDuration', () => {
  it('usa la primera regla cuyo max_party cubre el party', () => {
    expect(resolveDuration(rules, 1, 999)).toBe(60)
    expect(resolveDuration(rules, 2, 999)).toBe(60)
    expect(resolveDuration(rules, 3, 999)).toBe(90)
    expect(resolveDuration(rules, 8, 999)).toBe(120)
  })

  it('cae a la duración del shift cuando el party excede todas las reglas', () => {
    expect(resolveDuration(rules, 9, 105)).toBe(105)
  })

  it('cae a la duración del shift sin reglas', () => {
    expect(resolveDuration([], 4, 90)).toBe(90)
    expect(resolveDuration(null, 4, 90)).toBe(90)
    expect(resolveDuration(undefined, 4, 90)).toBe(90)
  })

  it('no depende del orden de las reglas', () => {
    const desordenadas = [rules[2], rules[0], rules[1]]
    expect(resolveDuration(desordenadas, 3, 999)).toBe(90)
  })
})
