import { describe, it, expect } from 'vitest'
import { e164 } from '@/lib/phone'

describe('e164', () => {
  it('normaliza números US de 10 dígitos', () => {
    expect(e164('9175550132')).toBe('+19175550132')
    expect(e164('(917) 555-0132')).toBe('+19175550132')
    expect(e164('917.555.0132')).toBe('+19175550132')
  })

  it('respeta el prefijo 1 existente', () => {
    expect(e164('19175550132')).toBe('+19175550132')
    expect(e164('+1 917 555 0132')).toBe('+19175550132')
  })
})
