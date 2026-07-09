'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

const supabase = getBrowserSupabase()

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    // Siempre éxito hacia el usuario: no revelamos si el email existe
    setSent(true)
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/login" className="block text-gray-500 text-sm mb-8">← Back to log in</a>
        <h1 className="text-3xl font-bold mb-3">Reset password</h1>

        {sent ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm leading-relaxed">
              If an account exists for <span className="text-white">{email}</span>, we sent a link
              to reset your password. Check your inbox (and spam folder).
            </p>
            <a href="/login" className="block text-center w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition">
              Back to log in
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm mb-4">
              Enter your account email and we'll send you a reset link.
            </p>
            <input type="email" placeholder="Email" value={email} autoFocus
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && email && handleSubmit()}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleSubmit} disabled={loading || !email}
              className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
