'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

const supabase = getBrowserSupabase()

export default function RegisterPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [refCode, setRefCode]   = useState(() => {
    if (typeof window !== 'undefined') {
      // Accept ?ref= from a shared referral link
      return new URLSearchParams(window.location.search).get('ref') || ''
    }
    return ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  const handleRegister = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: name, ref_code: refCode.trim() || null },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/onboarding`,
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
  }

  const handleGoogle = async () => {
    // Persist ref code across OAuth redirect (browser leaves and returns)
    if (refCode.trim()) localStorage.setItem('nativ_pending_ref', refCode.trim())
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/onboarding` },
    })
  }

  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold mb-3">Check your email</h1>
          <p className="text-gray-400">
            We sent a confirmation link to <strong className="text-white">{email}</strong>. Click it to activate your account.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="block text-gray-500 text-sm mb-8">← Nativ</a>
        <h1 className="text-3xl font-bold mb-2">Create account</h1>
        <p className="text-gray-500 text-sm mb-8">14-day free trial. No credit card required.</p>

        <div className="space-y-4">
          <button onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-600 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />
          <input type="password" placeholder="Password (min. 6 characters)" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />

          {/* Referral code */}
          <div>
            <input
              type="text"
              placeholder="Referral code (optional)"
              value={refCode}
              onChange={e => setRefCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400 font-mono tracking-widest"
            />
            {refCode.length === 6 && (
              <p className="text-green-400 text-xs mt-1 pl-1">Code applied — 50% off for 3 months ✓</p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleRegister} disabled={loading || !email || !password || !name}
            className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-white underline">Log in</a>
          </p>
        </div>
      </div>
    </main>
  )
}
