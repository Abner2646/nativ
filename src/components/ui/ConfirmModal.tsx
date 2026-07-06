'use client'

interface Props {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, message, confirmLabel = 'Delete', destructive = true, loading = false, onConfirm, onCancel,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <h2 className="font-satoshi font-bold text-[17px] text-offwhite mb-2">{title}</h2>
        {message && <p className="text-sm text-offwhite/50 leading-relaxed">{message}</p>}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40 ${
              destructive
                ? 'bg-red-500/90 hover:bg-red-500 text-white'
                : 'bg-offwhite text-midnight hover:bg-offwhite/90'
            }`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm text-offwhite/50 hover:text-offwhite transition-colors disabled:opacity-40"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
