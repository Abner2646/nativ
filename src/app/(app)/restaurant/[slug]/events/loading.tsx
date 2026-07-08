import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Events: botón + tabla de eventos + tarjeta de fechas bloqueadas
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="flex justify-end mb-6">
        <Sk className="h-10 w-32 rounded-xl" />
      </div>
      <SkCard className="overflow-hidden mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-4 px-4 py-4"
            style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
            <div className="flex-1 space-y-1.5">
              <Sk className="h-4 w-44" />
              <Sk className="h-3 w-28 opacity-60" />
            </div>
            <Sk className="h-4 w-16 opacity-60" />
          </div>
        ))}
      </SkCard>
      <SkCard className="p-5">
        <Sk className="h-3.5 w-32 mb-4 opacity-60" />
        <div className="flex gap-3 flex-wrap">
          <Sk className="h-10 w-40 rounded-xl" />
          <Sk className="h-10 flex-1 min-w-[140px] rounded-xl" />
          <Sk className="h-10 w-24 rounded-xl" />
        </div>
      </SkCard>
    </div>
  )
}
