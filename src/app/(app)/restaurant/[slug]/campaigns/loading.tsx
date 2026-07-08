import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Campaigns: filas de campañas con badge de estado y acciones
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <SkCard key={i} className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Sk className="h-4 w-40" />
                  <Sk className="h-5 w-16 rounded-full opacity-60" />
                </div>
                <Sk className="h-3.5 w-2/3 opacity-60" />
              </div>
              <Sk className="h-9 w-24 rounded-xl shrink-0" />
            </div>
          </SkCard>
        ))}
      </div>
    </div>
  )
}
