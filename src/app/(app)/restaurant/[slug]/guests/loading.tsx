import { Sk, SkCard } from '@/components/admin/Skeleton'

// Espeja Guests: buscador + split (lista | detalle) en md+, cards en mobile.
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <Sk className="h-7 w-32 mb-6 md:mb-8" />

      {/* Search */}
      <div className="flex items-center gap-3 mb-5">
        <Sk className="h-10 flex-1 rounded-xl" />
        <Sk className="h-4 w-16 shrink-0 opacity-60" />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {[0, 1, 2, 3].map(i => (
          <SkCard key={i} className="p-4 space-y-2">
            <Sk className="h-4 w-1/2" />
            <Sk className="h-3 w-2/3 opacity-60" />
          </SkCard>
        ))}
      </div>

      {/* md+: split view */}
      <div className="hidden md:flex gap-4 lg:gap-5 items-start">
        <SkCard className="w-[260px] lg:w-[280px] shrink-0 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-4 py-3.5 space-y-1.5"
              style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
              <Sk className="h-3.5 w-2/3" />
              <Sk className="h-3 w-4/5 opacity-60" />
            </div>
          ))}
        </SkCard>
        <SkCard className="flex-1 p-6 space-y-5">
          <div className="space-y-2">
            <Sk className="h-6 w-1/3" />
            <Sk className="h-4 w-1/2 opacity-60" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Sk className="h-12" />
            <Sk className="h-12" />
            <Sk className="h-12" />
          </div>
          <Sk className="h-20" />
        </SkCard>
      </div>
    </div>
  )
}
