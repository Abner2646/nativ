import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Deposits: tarjeta de Stripe Connect + reglas de depósito
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="space-y-4 max-w-2xl">
        <SkCard className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <Sk className="h-4 w-40" />
              <Sk className="h-3 w-56 opacity-60" />
            </div>
            <Sk className="h-10 w-36 rounded-xl" />
          </div>
        </SkCard>
        <SkCard className="overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Sk className="h-3.5 w-28 opacity-60" />
          </div>
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-4"
              style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
              <Sk className="h-4 w-32" />
              <Sk className="h-4 w-16 opacity-60" />
              <div className="flex-1" />
              <Sk className="h-4 w-14 opacity-60" />
            </div>
          ))}
        </SkCard>
      </div>
    </div>
  )
}
