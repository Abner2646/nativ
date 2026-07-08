import { Sk, SkCard } from '@/components/admin/Skeleton'

// Espeja el dashboard (la página índice de este segmento): grid de stats
// 2-col en mobile/tablet y 4-col en xl — igual que la página real — más
// la lista de highlights y el bloque de checklist. También actúa como
// fallback para páginas hijas sin loading.tsx propio.
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <Sk className="h-7 w-40 mb-6 md:mb-8" />

      {/* Stat cards — mismo grid responsive que el dashboard */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
        {[0, 1, 2, 3].map(i => (
          <SkCard key={i} className="p-5 md:p-6">
            <Sk className="h-3 w-20 mb-4 opacity-60" />
            <Sk className="h-9 md:h-10 w-16 mb-2" />
            <Sk className="h-3.5 w-24 opacity-60" />
          </SkCard>
        ))}
      </div>

      {/* Highlights de hoy */}
      <SkCard className="overflow-hidden mb-6 md:mb-8">
        <div className="px-4 md:px-6 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Sk className="h-3 w-36 opacity-60" />
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 md:px-6 py-3"
            style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
            <Sk className="h-4 w-11 shrink-0" />
            <Sk className="h-4 flex-1 max-w-[200px]" />
            <Sk className="h-5 w-20 rounded-full shrink-0 opacity-60" />
          </div>
        ))}
      </SkCard>

      {/* Bloque inferior (checklist / alertas) */}
      <SkCard className="px-4 py-4 md:px-6 md:py-5">
        <Sk className="h-4 w-28 mb-2" />
        <Sk className="h-3.5 w-64 mb-4 opacity-60" />
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-xl"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <Sk className="h-5 w-5 rounded-full shrink-0" />
              <Sk className="h-3.5 flex-1 max-w-[260px]" />
            </div>
          ))}
        </div>
      </SkCard>
    </div>
  )
}
