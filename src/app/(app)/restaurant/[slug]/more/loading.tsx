import { Sk, SkCard } from '@/components/admin/Skeleton'

// Espeja More: secciones agrupadas con filas ícono + título + descripción
export default function Loading() {
  return (
    <div className="p-4 md:p-8 pb-24">
      <Sk className="h-7 w-20 mb-6" />
      <div className="space-y-6">
        {[0, 1, 2].map(section => (
          <div key={section}>
            <Sk className="h-3 w-20 mb-2 ml-1 opacity-60" />
            <SkCard className="overflow-hidden">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-4 px-4 py-4"
                  style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.05)' } : undefined}>
                  <Sk className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Sk className="h-3.5 w-28" />
                    <Sk className="h-3 w-44 opacity-60" />
                  </div>
                </div>
              ))}
            </SkCard>
          </div>
        ))}
      </div>
    </div>
  )
}
