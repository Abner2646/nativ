// src/app/(marketing)/page.tsx
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-bold tracking-tight mb-4">Nativ</h1>
        <p className="text-xl text-gray-400 mb-3">Reservations that look like yours — not ours.</p>
        <p className="text-sm text-gray-600 mb-10">White-label reservation software for independent restaurants. No marketplace. No branding. Just your restaurant.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/register" className="bg-white text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-100 transition text-center">
            Start free trial
          </a>
          <a href="/login" className="border border-gray-700 text-white font-semibold px-8 py-4 rounded-lg hover:border-gray-500 transition text-center">
            Log in
          </a>
        </div>
        <p className="text-xs text-gray-600 mt-6">14 days free. No credit card required.</p>
      </div>
    </main>
  )
}
