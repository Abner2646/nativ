'use client'

import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

export function BackupButton() {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const supabase = getBrowserSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const res = await fetch('/api/superadmin/backup', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        ?? `nativ-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error downloading backup. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-white/[0.08] text-offwhite/50 hover:text-offwhite hover:border-white/[0.15] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="inline-block w-3 h-3 border border-offwhite/30 border-t-offwhite/70 rounded-full animate-spin" />
          Exporting…
        </>
      ) : (
        <>
          <DownloadIcon />
          Download backup
        </>
      )}
    </button>
  )
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1v7M3.5 5.5 6 8l2.5-2.5M1 9.5v.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-.5" />
    </svg>
  )
}
