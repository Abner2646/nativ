import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Billing: tarjeta de plan con precio + líneas de features + CTA
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <SkCard className="max-w-lg p-6 md:p-8">
        <Sk className="h-3 w-20 mb-4 opacity-60" />
        <Sk className="h-12 w-32 mb-2" />
        <Sk className="h-3.5 w-40 mb-6 opacity-60" />
        <div className="space-y-3 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Sk className="h-4 w-4 rounded-full shrink-0" />
              <Sk className="h-3.5 flex-1 max-w-[260px]" />
            </div>
          ))}
        </div>
        <Sk className="h-11 w-full rounded-xl" />
      </SkCard>
    </div>
  )
}
