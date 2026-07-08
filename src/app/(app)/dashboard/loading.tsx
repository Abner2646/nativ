import { Sk, SkCard } from '@/components/admin/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-midnight p-6 md:p-10">
      <Sk className="h-7 w-48 mb-8" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {[0, 1, 2].map(i => (
          <SkCard key={i} className="p-5 space-y-3">
            <Sk className="h-10 w-10 rounded-xl" />
            <Sk className="h-4 w-2/3" />
            <Sk className="h-3 w-1/2 opacity-60" />
          </SkCard>
        ))}
      </div>
    </div>
  )
}
