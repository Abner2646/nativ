import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Employees: barra de invitación + filas de miembros con badge de rol
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="flex gap-3 mb-6 flex-wrap">
        <Sk className="h-10 flex-1 min-w-[200px] rounded-xl" />
        <Sk className="h-10 w-24 rounded-xl" />
      </div>
      <SkCard className="overflow-hidden">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-4 px-4 py-4"
            style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
            <div className="flex-1 space-y-1.5">
              <Sk className="h-4 w-40" />
              <Sk className="h-3 w-52 opacity-60" />
            </div>
            <Sk className="h-5 w-16 rounded-full opacity-60" />
            <Sk className="h-3.5 w-16 opacity-60 hidden md:block" />
          </div>
        ))}
      </SkCard>
    </div>
  )
}
