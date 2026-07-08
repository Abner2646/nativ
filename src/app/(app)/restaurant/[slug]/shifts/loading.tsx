import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Shifts: botón de agregar + tarjeta por día con filas de turnos
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="flex justify-end mb-6">
        <Sk className="h-10 w-28 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <SkCard key={i} className="overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
              <Sk className="h-4 w-24" />
            </div>
            {i % 2 === 0 && (
              <div className="px-4 py-3.5 flex items-center gap-3">
                <Sk className="h-4 w-20" />
                <Sk className="h-3.5 w-28 opacity-60" />
                <div className="flex-1" />
                <Sk className="h-3.5 w-16 opacity-60" />
              </div>
            )}
          </SkCard>
        ))}
      </div>
    </div>
  )
}
