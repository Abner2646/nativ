import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja la vista de servicio: toggles + tabs + canvas con el mismo
// aspect ratio del plano real + columna lateral.
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />

      {/* Service / Edit layout */}
      <div className="flex gap-1.5 mb-4">
        <Sk className="h-9 w-28 rounded-xl" />
        <Sk className="h-9 w-32 rounded-xl" />
      </div>

      {/* Area tabs + view toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Sk className="h-9 w-24 rounded-xl" />
        <Sk className="h-9 w-24 rounded-xl" />
        <div className="flex-1" />
        <Sk className="h-9 w-44 rounded-xl hidden sm:block" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Canvas con el aspect ratio real (4:3) */}
        <div className="flex-1 w-full min-w-0">
          <div
            className="relative w-full rounded-2xl animate-pulse"
            style={{
              paddingBottom: '75%',
              backgroundColor: '#101c2b',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          />
        </div>

        {/* Waitlist + Needs a table */}
        <div className="w-full lg:w-80 shrink-0 space-y-3">
          {[0, 1].map(i => (
            <SkCard key={i} className="overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Sk className="h-3.5 w-24" />
              </div>
              <div className="px-4 py-3 space-y-2">
                <Sk className="h-4 w-2/3" />
                <Sk className="h-3 w-1/2 opacity-60" />
              </div>
            </SkCard>
          ))}
        </div>
      </div>
    </div>
  )
}
