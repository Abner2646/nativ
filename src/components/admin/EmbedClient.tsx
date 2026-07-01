'use client'
import { useState } from 'react'

interface Props {
  slug: string
}

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{label}</p>
      <div className="relative group">
        <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          {code}
        </pre>
        <button
          onClick={copy}
          className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition font-medium"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export function EmbedClient({ slug }: Props) {
  const baseUrl = `https://${slug}.nativ.com`
  const reserveUrl = `${baseUrl}/reserve`

  const iframeSnippet =
`<iframe
  src="${reserveUrl}"
  width="100%"
  height="680"
  frameborder="0"
  style="border-radius:12px; border:none;"
  title="Reserve a table"
></iframe>`

  const linkSnippet = `<a href="${reserveUrl}" target="_blank">Reserve a table</a>`

  return (
    <div className="max-w-2xl space-y-10">

      {/* iframe embed */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-2 pb-3 border-b border-gray-800 mb-6">
          Embed on your website
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Paste this code anywhere in your website's HTML — contact page, footer, a dedicated reservations page.
          The widget adapts to the width of its container.
        </p>
        <CopyBlock label="iframe snippet" code={iframeSnippet} />
      </div>

      {/* Direct link */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-2 pb-3 border-b border-gray-800 mb-6">
          Direct link
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Use this URL anywhere you want guests to book directly — WhatsApp bio, Instagram link-in-bio, Google Business, email signature.
        </p>
        <CopyBlock label="reservation URL" code={reserveUrl} />
        <CopyBlock label="HTML anchor" code={linkSnippet} />
      </div>

      {/* Preview */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-2 pb-3 border-b border-gray-800 mb-6">
          Preview
        </h2>
        <a
          href={reserveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-500 text-sm text-gray-300 hover:text-white px-4 py-2.5 rounded-lg transition"
        >
          Open reservation page ↗
        </a>
        <p className="text-xs text-gray-600 mt-3">
          Opens in a new tab — this is exactly what your guests will see.
        </p>
      </div>

    </div>
  )
}
