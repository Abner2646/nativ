'use client'
import { useState, useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

const supabase = getBrowserSupabase()

// Destino del link de recuperación. El link trae un code (PKCE) que se
// canjea por sesión; con sesión activa, el usuario define su nueva clave.
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)      // sesión de recovery lista
  const [invalid, setInvalid] = useState(false)  // link vencido/roto
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setInvalid(true); return }
        setReady(true)
        return
      }
      // Flow implícito (hash) o sesión ya establecida
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setReady(true)
      else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
        })
        setTimeout(() => { setInvalid(prev => prev || !ready) }, 4000)
        return () => subscription.unsubscribe()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords don\'t match.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1500)
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-3">New password</h1>

        {done ? (
          <p className="text-gray-400 text-sm">Password updated ✓ — taking you to your dashboard…</p>
        ) : invalid && !ready ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm leading-relaxed">
              This reset link is invalid or has expired. Request a new one.
            </p>
            <a href="/forgot-password" className="block text-center w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition">
              Request new link
            </a>
          </div>
        ) : !ready ? (
          <p className="text-gray-500 text-sm">Verifying your link…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm mb-4">Choose a new password for your account.</p>
            <input type="password" placeholder="New password" value={password} autoFocus
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />
            <input type="password" placeholder="Confirm new password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleSubmit} disabled={loading || !password || !confirm}
              className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
