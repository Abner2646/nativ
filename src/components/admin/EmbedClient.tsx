'use client'
import { useState, useEffect } from 'react'
import { getAppUrl, getTenantBaseUrl, getTenantReserveUrl } from '@/lib/domain'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { TenantSettings } from '@/lib/types'

// ── Constants ──────────────────────────────────────────────────

const SANS_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Raleway', 'Nunito', 'Lato']
const SERIF_FONTS = ['Merriweather', 'Playfair Display', 'Lora', 'EB Garamond', 'Cormorant Garamond', 'Libre Baskerville']
const FONT_GROUPS = [
  { label: 'Sans-serif', fonts: SANS_FONTS },
  { label: 'Serif',      fonts: SERIF_FONTS },
]

const BUTTON_STYLES = [
  { value: 'rounded', label: 'Rounded', radius: '0.625rem' },
  { value: 'sharp',   label: 'Sharp',   radius: '0' },
  { value: 'pill',    label: 'Pill',    radius: '9999px' },
]

const THEMES = [
  { id: 'light',   label: 'Light',   bg: '#FFFFFF', values: { primary_color: '#111111', secondary_color: '#555555', background_color: '#FFFFFF', font_family: 'Inter',            button_style: 'rounded' } },
  { id: 'dark',    label: 'Dark',    bg: '#18181B', values: { primary_color: '#FAFAFA', secondary_color: '#A0A0A0', background_color: '#18181B', font_family: 'Inter',            button_style: 'rounded' } },
  { id: 'warm',    label: 'Warm',    bg: '#F5EDD8', values: { primary_color: '#2C1810', secondary_color: '#7A5035', background_color: '#F5EDD8', font_family: 'Lora',             button_style: 'rounded' } },
  { id: 'elegant', label: 'Elegant', bg: '#0D0D0D', values: { primary_color: '#C9A96E', secondary_color: '#888888', background_color: '#0D0D0D', font_family: 'Playfair Display', button_style: 'sharp'   } },
]

// ── Helpers ────────────────────────────────────────────────────

function isDark(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  } catch { return true }
}

// ── Widget preview mock ────────────────────────────────────────

interface PreviewProps {
  name: string
  bgColor: string
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  buttonStyle: string
}

function WidgetPreview({ name, bgColor, primaryColor, secondaryColor, fontFamily, buttonStyle }: PreviewProps) {
  const btnRadius = buttonStyle === 'pill' ? '9999px' : buttonStyle === 'sharp' ? '0' : '0.625rem'
  const btnText   = isDark(primaryColor) ? '#FAFAFA' : '#111111'
  const inputBg     = isDark(bgColor) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'
  const inputBorder = isDark(bgColor) ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const f = { fontFamily: `'${fontFamily}', sans-serif` }

  return (
    <div style={{ backgroundColor: bgColor, ...f, padding: '28px', borderRadius: '14px' }}>
      <p style={{ color: secondaryColor, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: 600 }}>
        Reserve a table
      </p>
      <h2 style={{ color: primaryColor, fontSize: '22px', fontWeight: 700, lineHeight: 1.2, marginBottom: '22px' }}>
        {name || 'Your Restaurant'}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
        <div>
          <label style={{ color: secondaryColor, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px', fontWeight: 600 }}>Date</label>
          <div style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${inputBorder}`, color: primaryColor, fontSize: '14px', backgroundColor: inputBg }}>
            Thursday, June 26
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {(['Guests', 'Time'] as const).map((lbl, i) => (
            <div key={lbl}>
              <label style={{ color: secondaryColor, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px', fontWeight: 600 }}>{lbl}</label>
              <div style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${inputBorder}`, color: primaryColor, fontSize: '14px', backgroundColor: inputBg }}>
                {i === 0 ? '2 people' : '8:00 PM'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button style={{ width: '100%', padding: '13px', borderRadius: btnRadius, backgroundColor: primaryColor, color: btnText, fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', ...f }}>
        Find a table
      </button>
      <p style={{ color: secondaryColor, fontSize: '11px', textAlign: 'center', marginTop: '14px', opacity: 0.5 }}>
        Powered by Nativ
      </p>
    </div>
  )
}

// ── Small UI helpers ───────────────────────────────────────────

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div>
      <p className="text-xs text-offwhite/35 uppercase tracking-widest mb-3 font-semibold">{label}</p>
      <div className="relative">
        <pre className="rounded-xl p-4 text-xs text-offwhite/60 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {code}
        </pre>
        <button onClick={copy}
          className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-offwhite/50 hover:text-offwhite"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function SectionH({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold">{title}</h2>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
          style={badge === 'Recommended'
            ? { backgroundColor: 'rgba(111,143,123,0.15)', color: '#6F8F7B' }
            : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(242,239,233,0.35)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-offwhite/35 uppercase tracking-widest mb-2 block font-semibold">{children}</label>
}

// ── Main component ─────────────────────────────────────────────

interface Props { slug: string; settings: TenantSettings | null }

export function EmbedClient({ slug, settings }: Props) {
  const appUrl  = getAppUrl()
  const isLocal = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')
  const reserveUrl = getTenantReserveUrl(slug)
  const publicUrl  = getTenantBaseUrl(slug)
  const scriptSrc  = `${appUrl}/embed.js?tenant=${slug}`

  // Visual settings — initialize from saved settings, drive the preview
  const [bgColor,        setBgColor]        = useState(settings?.background_color || '#FFFFFF')
  const [primaryColor,   setPrimaryColor]   = useState(settings?.primary_color    || '#111111')
  const [secondaryColor, setSecondaryColor] = useState(settings?.secondary_color  || '#666666')
  const [fontFamily,     setFontFamily]     = useState(settings?.font_family      || 'Inter')
  const [buttonStyle,    setButtonStyle]    = useState(settings?.button_style     || 'rounded')
  const [fontOpen,       setFontOpen]       = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)

  // Dynamically load Google Font when font changes
  useEffect(() => {
    const encoded = fontFamily.replace(/ /g, '+')
    const id = `gfont-${encoded}`
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id; link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`
      document.head.appendChild(link)
    }
  }, [fontFamily])

  const applyTheme = (theme: typeof THEMES[0]) => {
    setBgColor(theme.values.background_color)
    setPrimaryColor(theme.values.primary_color)
    setSecondaryColor(theme.values.secondary_color)
    setFontFamily(theme.values.font_family)
    setButtonStyle(theme.values.button_style)
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    const { data: { session } } = await getBrowserSupabase().auth.getSession()
    const token = session?.access_token || ''
    const res = await fetch(`/api/admin?resource=settings&tenant=${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ background_color: bgColor, primary_color: primaryColor, secondary_color: secondaryColor, font_family: fontFamily, button_style: buttonStyle }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const colorFields = [
    { label: 'Background', value: bgColor,        set: setBgColor },
    { label: 'Primary',    value: primaryColor,   set: setPrimaryColor },
    { label: 'Secondary',  value: secondaryColor, set: setSecondaryColor },
  ]

  const scriptSnippet = `<script src="${scriptSrc}"></script>`
  const iframeSnippet = `<iframe\n  src="${reserveUrl}"\n  width="100%"\n  height="680"\n  frameborder="0"\n  style="border-radius:12px; border:none;"\n  title="Reserve a table"\n></iframe>`

  return (
    <div className="grid gap-10 items-start" style={{ gridTemplateColumns: '1fr 320px' }}>

      {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
      <div className="space-y-10 min-w-0">

        {isLocal && (
          <div className="px-4 py-3 rounded-xl text-xs text-gold"
            style={{ backgroundColor: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.20)' }}>
            You're in development — URLs point to <code className="font-mono">localhost</code>. In production they use your real domain.
          </div>
        )}

        {/* Quick themes */}
        <div>
          <SectionH title="Quick themes" />
          <p className="text-xs text-offwhite/35 mb-3">Start from a preset, then fine-tune below before saving.</p>
          <div className="flex flex-wrap gap-2">
            {THEMES.map(theme => (
              <button key={theme.id} onClick={() => applyTheme(theme)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors text-offwhite/60 hover:text-offwhite"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: theme.bg }} />
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div>
          <SectionH title="Colors" />
          <div className="grid grid-cols-3 gap-4">
            {colorFields.map(({ label, value, set }) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <div className="flex gap-2 items-center">
                  <input type="color" value={value} onChange={e => set(e.target.value)}
                    className="h-9 w-9 rounded-lg cursor-pointer flex-shrink-0"
                    style={{ border: '1px solid rgba(255,255,255,0.10)', backgroundColor: 'transparent' }} />
                  <input type="text" value={value} onChange={e => set(e.target.value)}
                    className="flex-1 min-w-0 text-offwhite text-xs font-mono rounded-lg px-2.5 py-2 focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Button style */}
        <div>
          <SectionH title="Button style" />
          <div className="grid grid-cols-3 gap-3">
            {BUTTON_STYLES.map(s => {
              const active = buttonStyle === s.value
              return (
                <button key={s.value} type="button" onClick={() => setButtonStyle(s.value)}
                  className={`flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl transition-colors ${active ? 'text-offwhite' : 'text-offwhite/40 hover:text-offwhite/70'}`}
                  style={{
                    border: active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                  }}>
                  <div className="w-full h-7 flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: active ? '#F2EFE9' : 'rgba(255,255,255,0.06)', color: active ? '#0F1720' : 'rgba(242,239,233,0.35)', borderRadius: s.radius }}>
                    Book
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font */}
        <div>
          <SectionH title="Font" />
          <div className="relative">
            <button type="button" onClick={() => setFontOpen(o => !o)}
              className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between gap-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-offwhite font-medium" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>{fontFamily}</span>
              <span className="text-offwhite/35 flex-shrink-0">{fontOpen ? '▲' : '▼'}</span>
            </button>
            {fontOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto"
                style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.10)' }}>
                {FONT_GROUPS.map((group, gi) => (
                  <div key={group.label}>
                    <p className="text-[10px] text-offwhite/25 uppercase tracking-widest px-4 pt-3 pb-1 font-semibold"
                      style={gi > 0 ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : {}}>
                      {group.label}
                    </p>
                    {group.fonts.map(f => (
                      <button key={f} type="button" onClick={() => { setFontFamily(f); setFontOpen(false) }}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-4 ${fontFamily === f ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}`}>
                        <span className="text-offwhite text-sm font-medium" style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
                        <span className="text-offwhite/35 text-xs" style={{ fontFamily: `'${f}', sans-serif` }}>Aa Bb 123</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4 pb-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={save} disabled={saving}
            className="bg-offwhite text-midnight font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : 'Save appearance'}
          </button>
          {saved && <span className="text-sm text-sage">Saved ✓</span>}
        </div>

        {/* ── Code snippets ── */}
        <div className="space-y-10">
          <div>
            <SectionH title="Your public page" />
            <p className="text-sm text-offwhite/50 mb-5">Your restaurant's standalone page — photos, description, and the reservation panel all in one.</p>
            <CopyBlock label="public page URL" code={publicUrl} />
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl mt-3 transition-colors text-offwhite/60 hover:text-offwhite"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Open your page ↗
            </a>
          </div>

          <div>
            <SectionH title="Widget script" badge="Recommended" />
            <p className="text-sm text-offwhite/50 mb-5">
              Paste before <code className="font-mono text-offwhite/70">&lt;/body&gt;</code>.
              Adds a floating "Reserve a table" button that opens a modal.
            </p>
            <CopyBlock label="one-line snippet" code={scriptSnippet} />
          </div>

          <div>
            <SectionH title="Direct reservation link" />
            <p className="text-sm text-offwhite/50 mb-5">Links straight to the form. Perfect for Instagram bio, Google Business, WhatsApp.</p>
            <CopyBlock label="reservation URL" code={reserveUrl} />
          </div>

          <div>
            <SectionH title="Inline iframe" badge="Alternative" />
            <p className="text-sm text-offwhite/50 mb-5">Embed the form inline in a section of your page. Occupies layout space.</p>
            <CopyBlock label="iframe snippet" code={iframeSnippet} />
          </div>
        </div>
      </div>

      {/* ══ RIGHT COLUMN — sticky preview ════════════════════ */}
      <div className="sticky top-8">
        <p className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold mb-3">Live preview</p>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-3 py-2.5"
            style={{ backgroundColor: '#2A2A2E', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF5F57' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FFBD2E' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#28C840' }} />
            </div>
            <div className="flex-1 rounded-md px-3 py-1 text-[10px] text-offwhite/25 truncate font-mono"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              yourrestaurant.com
            </div>
          </div>
          {/* Fake page background + widget */}
          <div className="p-5" style={{ backgroundColor: '#EFEFEF' }}>
            <WidgetPreview
              name={settings?.name || ''}
              bgColor={bgColor}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              fontFamily={fontFamily}
              buttonStyle={buttonStyle}
            />
          </div>
        </div>
        <p className="text-xs text-offwhite/25 mt-2.5">
          Updates live as you tweak. Click "Save appearance" to publish.
        </p>
      </div>

    </div>
  )
}
