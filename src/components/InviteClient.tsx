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
