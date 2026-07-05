'use client'
import { useState, useRef } from 'react'
import { TenantPhoto } from '@/lib/types'

interface Props { slug: string; initialLogo: string | null; initialPhotos: TenantPhoto[] }

export function PhotosClient({ slug, initialLogo, initialPhotos }: Props) {
  const [logo, setLogo] = useState<string | null>(initialLogo)
  const [photos, setPhotos] = useState<TenantPhoto[]>(initialPhotos)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')

  const logoRef  = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File, type: 'logo' | 'photo') => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG and WebP images are allowed'); return
    }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5 MB'); return }
    setError('')
    if (type === 'logo') setUploadingLogo(true); else setUploadingPhoto(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/upload?type=${type}&tenant=${slug}`, { method: 'POST', body: formData })
    const data = await res.json()
    if (type === 'logo') {
      setUploadingLogo(false)
      if (res.ok) setLogo(data.url); else setError(data.error || 'Upload failed')
    } else {
      setUploadingPhoto(false)
      if (res.ok && data.photo) setPhotos(prev => [...prev, data.photo]); else setError(data.error || 'Upload failed')
    }
  }

  const deletePhoto = async (id: string) => {
    const res = await fetch(`/api/upload?id=${id}&tenant=${slug}`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id)); else setError('Delete failed')
  }

  const sectionTitle = (t: string) => (
    <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold pt-6 pb-3 mb-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t}</h2>
  )

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400"
          style={{ backgroundColor: 'rgba(224,85,85,0.10)', border: '1px solid rgba(224,85,85,0.20)' }}>
          {error}
        </div>
      )}

      {sectionTitle('Isotipo')}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0"
          style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          {logo ? (
            <img src={logo} alt="Isotipo" className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-offwhite/20 text-xs text-center px-2">No isotipo</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-offwhite/50 mb-1">
            Your brand symbol shown in the reservation widget. Must be <strong className="text-offwhite/70">square</strong> — ideally 1:1, at least 400×400 px.
          </p>
          <p className="text-xs text-offwhite/25 mb-3">Not a wide logo — just the icon or emblem.</p>
          <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'logo')} />
          <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 text-offwhite/70 hover:text-offwhite"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {uploadingLogo ? 'Uploading…' : logo ? 'Replace isotipo' : 'Upload isotipo'}
          </button>
        </div>
      </div>

      {sectionTitle('Photo gallery')}
      <p className="text-sm text-offwhite/50 mb-4">Photos shown on your public page. Max 5 MB per photo.</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {photos.map(photo => (
          <div key={photo.id} className="relative group aspect-square rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#162232' }}>
            <img src={photo.url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => deletePhoto(photo.id)}
              className="absolute inset-0 bg-black/60 text-offwhite text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              Delete
            </button>
          </div>
        ))}
        <button onClick={() => photoRef.current?.click()} disabled={uploadingPhoto}
          className="aspect-square rounded-2xl flex flex-col items-center justify-center text-offwhite/25 hover:text-offwhite/50 transition-colors disabled:opacity-40"
          style={{ border: '2px dashed rgba(255,255,255,0.10)' }}>
          {uploadingPhoto ? (
            <div className="w-5 h-5 border-2 border-offwhite/20 border-t-offwhite/60 rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-2xl mb-1">+</span>
              <span className="text-xs">Add photo</span>
            </>
          )}
        </button>
      </div>
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'photo')} />
    </div>
  )
}
