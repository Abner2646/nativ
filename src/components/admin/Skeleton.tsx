// Bloques de skeleton para los loading.tsx del admin.
// Server-safe: solo CSS (animate-pulse), sin interactividad.

export function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />
}

export function SkCard({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  )
}

// Encabezado de página estándar (título + subtítulo)
export function SkPageHeader() {
  return (
    <div className="mb-6 md:mb-8">
      <Sk className="h-7 w-44 mb-2" />
      <Sk className="h-4 w-72 opacity-60" />
    </div>
  )
}
