import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Skeleton genérico para cualquier página del restaurante sin uno propio.
// Las páginas de más tráfico (reservations, floor-plan, guests) tienen
// loading.tsx a medida en su segmento.
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => (
          <SkCard key={i} className="p-5">
            <div className="flex items-center gap-4">
              <Sk className="h-9 w-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-4 w-1/3" />
                <Sk className="h-3 w-1/2 opacity-60" />
              </div>
            </div>
          </SkCard>
        ))}
      </div>
    </div>
  )
}
