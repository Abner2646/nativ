import { Sk } from '@/components/admin/Skeleton'

// Espeja Settings: secciones con inputs apilados (max-w-2xl como la página)
export default function Loading() {
  return (
    <div className="p-4 md:p-8">
      <Sk className="h-7 w-32 mb-6 md:mb-8" />
      <div className="max-w-2xl space-y-8">
        {[0, 1].map(section => (
          <div key={section}>
            <Sk className="h-3.5 w-24 mb-5 opacity-60" />
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i}>
                  <Sk className="h-3 w-28 mb-2 opacity-60" />
                  <Sk className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Sk key={i} className="h-10 rounded-xl" />)}
        </div>
        <Sk className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  )
}
