import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Photos: zona de upload + grilla de imágenes cuadradas
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <SkCard className="p-8 mb-6 flex items-center justify-center">
        <Sk className="h-4 w-56" />
      </SkCard>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Sk key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  )
}
