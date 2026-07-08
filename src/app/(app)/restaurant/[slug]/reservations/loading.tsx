import { Sk, SkCard } from '@/components/admin/Skeleton'

// Espeja el layout real: toolbar + split view (lista | panel) en md+,
// cards apiladas en mobile.
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <Sk className="h-7 w-40 mb-6 md:mb-8" />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center">
        <div className="flex gap-3">
          <Sk className="h-10 w-36 rounded-xl" />
          <Sk className="h-10 w-28 rounded-xl" />
        </div>
        <div className="hidden md:flex flex-1" />
        <Sk className="h-10 w-full md:w-40 rounded-xl" />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {[0, 1, 2, 3].map(i => (
          <SkCard key={i} className="p-4 space-y-3">
            <div className="flex justify-between">
              <Sk className="h-6 w-16" />
              <Sk className="h-5 w-20 rounded-full" />
            </div>
            <Sk className="h-4 w-1/2" />
            <Sk className="h-3 w-2/3 opacity-60" />
          </SkCard>
        ))}
      </div>

      {/* md+: split view */}
      <div className="hidden md:flex gap-4 lg:gap-5 items-start">
        <SkCard className="w-[260px] lg:w-[280px] shrink-0 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-3"
              style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
              <Sk className="h-5 w-11 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3.5 w-3/4" />
                <Sk className="h-3 w-1/3 opacity-60" />
              </div>
            </div>
          ))}
        </SkCard>
        <SkCard className="flex-1 p-6 space-y-5">
          <div className="flex justify-between">
            <Sk className="h-12 w-28" />
            <Sk className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Sk className="h-4 w-1/3" />
            <Sk className="h-3.5 w-1/2 opacity-60" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Sk className="h-10" />
            <Sk className="h-10" />
          </div>
          <div className="flex gap-2">
            <Sk className="h-10 flex-1 rounded-xl" />
            <Sk className="h-10 flex-1 rounded-xl" />
            <Sk className="h-10 flex-1 rounded-xl" />
          </div>
        </SkCard>
      </div>
    </div>
  )
}
