'use client'
import { useState } from 'react'
import { getAppUrl, getTenantBaseUrl, getTenantReserveUrl, getTenantDomain } from '@/lib/domain'

interface Props {
  slug: string
}

function CopyBlock({ label, code, lang = 'html' }: { label: string; code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{label}</p>
      <div className="relative">
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
  const appUrl     = getAppUrl()
  const isLocal    = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')
  const scriptSrc  = `${appUrl}/embed.js?tenant=${slug}`
  const publicUrl  = getTenantBaseUrl(slug)
  const reserveUrl = getTenantReserveUrl(slug)

  const scriptSnippet = `<script src="${scriptSrc}"></script>`

  const scriptSnippetCustom =
`<!-- Optional: customise button color and label -->
<script src="${scriptSrc}&color=%23c0392b&text=Book%20a%20table"></script>`

  const iframeSnippet =
`<iframe
  src="${reserveUrl}"
  width="100%"
  height="680"
  frameborder="0"
  style="border-radius:12px; border:none;"
  title="Reserve a table"
></iframe>`

  return (
    <div className="max-w-2xl space-y-10">

      {isLocal && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-4 py-3 text-xs text-yellow-400">
          You're in development — URLs point to <code className="font-mono">localhost</code>. In production they will use your configured domain.
        </div>
      )}

      {/* ── Public page ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-2 pb-3 border-b border-gray-800 mb-6">
          Your public page
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          This is your restaurant's standalone page — photos, description, and the reservation panel all in one. Share it anywhere or use it as your main online presence.
        </p>
        <CopyBlock label="public page URL" code={publicUrl} />
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 bg-gray-900 border border-gray-700 hover:border-gray-500 text-sm text-gray-300 hover:text-white px-4 py-2.5 rounded-lg transition"
        >
          Open your page ↗
        </a>
      </div>

      {/* ── Script widget (recommended) ── */}
      <div>
        <div className="flex items-center gap-3 pb-3 border-b border-gray-800 mb-6">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
            Widget script
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-green-900/40 text-green-400 px-2 py-0.5 rounded">
            Recommended
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Paste this single line before the <code className="font-mono text-gray-300">&lt;/body&gt;</code> tag.
          It automatically adds a <strong className="text-white">floating "Reserve a table" button</strong> that opens a reservation modal — no extra code needed.
        </p>
        <CopyBlock label="one-line snippet" code={scriptSnippet} />

        <div className="mt-6">
          <CopyBlock label="with custom color + label (optional)" code={scriptSnippetCustom} />
          <p className="text-xs text-gray-600 mt-2">
            <code className="font-mono">color</code> accepts any hex color (URL-encoded). <code className="font-mono">text</code> accepts any label text (URL-encoded).
          </p>
        </div>

        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p>The script injects:</p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>A fixed floating button (bottom-right)</li>
            <li>A dark overlay + centered modal on click</li>
            <li>Close on × button, click outside, or Esc</li>
            <li>The iframe only loads when the modal opens</li>
          </ul>
          <p className="mt-2">Optional JS API: <code className="font-mono text-gray-400">Nativ.open()</code> / <code className="font-mono text-gray-400">Nativ.close()</code></p>
        </div>
      </div>

      {/* ── Direct reservation link ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-2 pb-3 border-b border-gray-800 mb-6">
          Direct reservation link
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Links straight to the reservation form, skipping the landing page. Ideal for WhatsApp bio, Instagram link-in-bio, Google Business, or email signatures.
        </p>
        <CopyBlock label="reservation-only URL" code={reserveUrl} />
      </div>

      {/* ── iframe (alternative) ── */}
      <div>
        <div className="flex items-center gap-3 pb-3 border-b border-gray-800 mb-6">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
            Inline iframe
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
            Alternative
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Embed the reservation form inline in a specific section of your page. Unlike the widget script, this occupies space in the page layout.
        </p>
        <CopyBlock label="iframe snippet" code={iframeSnippet} />
      </div>

      {/* ── Preview ── */}
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
          This is exactly what your guests see inside the modal.
        </p>
      </div>

    </div>
  )
}
