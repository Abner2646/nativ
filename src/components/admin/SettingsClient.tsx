'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { TenantSettings } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Bogota',
  'America/Mexico_City', 'America/Lima', 'America/Santiago',
  'Europe/London', 'Europe/Madrid', 'Europe/Paris',
]

const FONTS = ['Inter', 'Georgia', 'Merriweather', 'Playfair Display', 'Lato', 'Montserrat']

interface Props {
  settings: TenantSettings
  slug: string
}

export function SettingsClient({ settings: initial, slug }: Props) {
  const [form, setForm] = useState<TenantSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (key: keyof TenantSettings, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=settings&tenant=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">{label}</label>
      {children}
    </div>
  )

  const Input = ({ field, type = 'text', placeholder = '' }: { field: keyof TenantSettings; type?: string; placeholder?: string }) => (
    <input
      type={type}
      value={(form[field] as string) || ''}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
    />
  )

  const section = (title: string) => (
    <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-6 pb-3 border-b border-gray-800 mb-4">
      {title}
    </h2>
  )

  return (
    <div className="max-w-2xl">
      {section('General')}
      <div className="space-y-4">
        <Field label="Restaurant name">
          <Input field="name" placeholder="Off The Hook" />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="Short description shown on your public page"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600 resize-none"
          />
        </Field>
        <Field label="Address">
          <Input field="address" placeholder="123 Main St, City" />
        </Field>
        <Field label="Phone">
          <Input field="phone" type="tel" placeholder="+1 555 000 0000" />
        </Field>
        <Field label="Hours (public display)">
          <Input field="hours_text" placeholder="Mon–Fri 12–15 & 19–23, Sat–Sun 19–23" />
        </Field>
      </div>

      {section('Booking rules')}
      <div className="space-y-4">
        <Field label="Timezone">
          <select
            value={form.timezone}
            onChange={e => set('timezone', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Min party">
            <input
              type="number"
              min={1}
              value={form.min_party_size}
              onChange={e => set('min_party_size', parseInt(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            />
          </Field>
          <Field label="Max party">
            <input
              type="number"
              min={1}
              value={form.max_party_size}
              onChange={e => set('max_party_size', parseInt(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            />
          </Field>
          <Field label="Min advance (hrs)">
            <input
              type="number"
              min={0}
              value={form.min_advance_hours}
              onChange={e => set('min_advance_hours', parseInt(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            />
          </Field>
        </div>
        <Field label="Notification email">
          <Input field="notification_email" type="email" placeholder="owner@restaurant.com" />
        </Field>
      </div>

      {section('Social links')}
      <div className="space-y-4">
        <Field label="Instagram">
          <Input field="instagram_url" placeholder="https://instagram.com/yourrestaurant" />
        </Field>
        <Field label="Facebook">
          <Input field="facebook_url" placeholder="https://facebook.com/yourrestaurant" />
        </Field>
        <Field label="TripAdvisor">
          <Input field="tripadvisor_url" placeholder="https://tripadvisor.com/…" />
        </Field>
        <Field label="Yelp">
          <Input field="yelp_url" placeholder="https://yelp.com/biz/…" />
        </Field>
      </div>

      {section('Branding')}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Primary color">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.primary_color}
                onChange={e => set('primary_color', e.target.value)}
                className="h-10 w-10 rounded border border-gray-700 bg-transparent cursor-pointer"
              />
              <input
                value={form.primary_color}
                onChange={e => set('primary_color', e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none font-mono"
              />
            </div>
          </Field>
          <Field label="Secondary color">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.secondary_color}
                onChange={e => set('secondary_color', e.target.value)}
                className="h-10 w-10 rounded border border-gray-700 bg-transparent cursor-pointer"
              />
              <input
                value={form.secondary_color}
                onChange={e => set('secondary_color', e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none font-mono"
              />
            </div>
          </Field>
          <Field label="Background color">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.background_color}
                onChange={e => set('background_color', e.target.value)}
                className="h-10 w-10 rounded border border-gray-700 bg-transparent cursor-pointer"
              />
              <input
                value={form.background_color}
                onChange={e => set('background_color', e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none font-mono"
              />
            </div>
          </Field>
        </div>
        <Field label="Font">
          <select
            value={form.font_family}
            onChange={e => set('font_family', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-white text-black font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
      </div>
    </div>
  )
}
