'use client'
import { useState, useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

interface Props {
  token: string
  email: string
  restaurantName: string
  slug: string
}

export function InviteClient({ token, email, restaurantName, slug }: Props) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  const [loginEmail, setLoginEmail] = useState(email)
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const supabase = getBrowserSupabase()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session)
    })
  }, [])

  const accept = async () => {
    setAccepting(true)
    setError('')
    const res = await fetch(`/api/invite?token=${token}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to accept invite')
      setAccepting(false)
      return
    }
    window.location.href = `/restaurant/${data.slug || slug}`
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/invite${window.location.search}` },
    })
  }

  const handleAuth = async () => {
    setAuthLoading(true)
    setAuthError('')
    let err
    if (mode === 'login') {
      const result = await supabase.auth.signInWithPassword({ email: loginEmail, password })
      err = result.error
    } else {
      const result = await supabase.auth.signUp({ email: loginEmail, password })
      err = result.error
    }
    if (err) {
      setAuthError(err.message)
      setAuthLoading(false)
      return
    }
    setLoggedIn(true)
    setAuthLoading(false)
  }

  if (loggedIn === null) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="block text-gray-500 text-sm mb-8">← Nativ</a>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Invitation to</p>
          <h1 className="text-xl font-bold text-white mb-1">{restaurantName}</h1>
          <p className="text-sm text-gray-400">Sent to {email}</p>
        </div>

        {loggedIn ? (
          <div className="space-y-3">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={accept}
              disabled={accepting}
              className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-40"
            >
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              {mode === 'login' ? 'Log in to accept the invitation.' : 'Create an account to accept.'}
            </p>

            <button onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition">
              <svg width="18" height="18" viewBox="0 0 24 24">
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

            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              placeholder="Password"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400"
            />

            {authError && <p className="text-red-400 text-sm">{authError}</p>}

            <button
              onClick={handleAuth}
              disabled={authLoading || !loginEmail || !password}
              className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-40"
            >
              {authLoading ? 'Please wait…' : mode === 'login' ? 'Log in & accept' : 'Sign up & accept'}
            </button>

            <p className="text-center text-sm text-gray-600">
              {mode === 'login' ? (
                <>No account? <button onClick={() => setMode('register')} className="text-white underline">Sign up</button></>
              ) : (
                <>Already have an account? <button onClick={() => setMode('login')} className="text-white underline">Log in</button></>
              )}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
