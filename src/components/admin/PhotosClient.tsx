'use client'
import { useState, useRef } from 'react'
import { TenantPhoto } from '@/lib/types'

interface Props {
  slug: string
  initialLogo: string | null
  initialPhotos: TenantPhoto[]
}

export function PhotosClient({ slug, initialLogo, initialPhotos }: Props) {
  const [logo, setLogo] = useState<string | null>(initialLogo)
  const [photos, setPhotos] = useState<TenantPhoto[]>(initialPhotos)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')

  const logoRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File, type: 'logo' | 'photo') => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG and WebP images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5 MB')
      return
    }

    setError('')
    if (type === 'logo') setUploadingLogo(true)
    else setUploadingPhoto(true)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/upload?type=${type}&tenant=${slug}`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()

    if (type === 'logo') {
      setUploadingLogo(false)
      if (res.ok) setLogo(data.url)
      else setError(data.error || 'Upload failed')
    } else {
      setUploadingPhoto(false)
      if (res.ok && data.photo) setPhotos(prev => [...prev, data.photo])
      else setError(data.error || 'Upload failed')
    }
  }

  const deletePhoto = async (id: string) => {
    const res = await fetch(`/api/upload?id=${id}&tenant=${slug}`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id))
    else setError('Delete failed')
  }

  const section = (title: string) => (
    <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-6 pb-3 border-b border-gray-800 mb-4">
      {title}
    </h2>
  )

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {section('Logo')}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-24 h-24 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logo ? (
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-700 text-xs text-center px-2">No logo</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-3">
            Shown on your public page and emails. Recommended: square, at least 400×400px.
          </p>
          <input
            ref={logoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'logo')}
          />
          <button
            onClick={() => logoRef.current?.click()}
            disabled={uploadingLogo}
            className="bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-40"
          >
            {uploadingLogo ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
          </button>
        </div>
      </div>

      {section('Photo gallery')}
      <p className="text-sm text-gray-400 mb-4">
        Photos shown on your public page. Max 5 MB per photo.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {photos.map(photo => (
          <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-900">
            <img src={photo.url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => deletePhoto(photo.id)}
              className="absolute inset-0 bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1"
            >
              Delete
            </button>
          </div>
        ))}
        <button
          onClick={() => photoRef.current?.click()}
          disabled={uploadingPhoto}
          className="aspect-square rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-600 hover:border-gray-500 hover:text-gray-400 transition disabled:opacity-40"
        >
          {uploadingPhoto ? (
            <div className="w-5 h-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-2xl mb-1">+</span>
              <span className="text-xs">Add photo</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'photo')}
      />
    </div>
  )
}
