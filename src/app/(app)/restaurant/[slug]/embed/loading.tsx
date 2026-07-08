import { Sk, SkCard, SkPageHeader } from '@/components/admin/Skeleton'

// Espeja Embed & share: columna de código/links + panel de preview a la derecha
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <SkPageHeader />
      <div className="flex flex-col gap-8 md:grid md:gap-10 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
        <div className="w-full space-y-6">
          <SkCard className="p-5 space-y-3">
            <Sk className="h-3.5 w-28 opacity-60" />
            <Sk className="h-24 w-full rounded-xl" />
            <Sk className="h-9 w-28 rounded-xl" />
          </SkCard>
          <SkCard className="p-5 space-y-3">
            <Sk className="h-3.5 w-24 opacity-60" />
            <Sk className="h-10 w-full rounded-xl" />
          </SkCard>
        </div>
        <SkCard className="w-full p-5 space-y-4">
          <Sk className="h-3.5 w-20 opacity-60" />
          <Sk className="h-64 w-full rounded-xl" />
        </SkCard>
      </div>
    </div>
  )
}
