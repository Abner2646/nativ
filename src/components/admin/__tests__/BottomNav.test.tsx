// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/components/admin/BottomNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/restaurant/oth',
}))

describe('BottomNav por rol', () => {
  it('admin ve 5 tabs con Home primero y More al final', () => {
    render(<BottomNav slug="oth" role="admin" />)
    const labels = screen.getAllByRole('link').map(l => l.textContent)
    expect(labels).toEqual(['Home', 'Reservations', 'Floor', 'Guests', 'More'])
  })

  it('employee ve 3 tabs con Floor como home (sin Dashboard ni More)', () => {
    render(<BottomNav slug="oth" role="employee" />)
    const labels = screen.getAllByRole('link').map(l => l.textContent)
    expect(labels).toEqual(['Floor', 'Reservations', 'Guests'])
  })

  it('el badge de reservas de hoy aparece en Reservations', () => {
    render(<BottomNav slug="oth" role="admin" todayCount={7} />)
    expect(screen.getByText('7')).toBeTruthy()
  })
})
