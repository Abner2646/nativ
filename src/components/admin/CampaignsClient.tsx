'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { AiCampaign, BirthdayCampaignConfig } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props {
  initialCampaigns: AiCampaign[]
  initialBirthdayConfig: BirthdayCampaignConfig | null
  slug: string
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-900/40 text-yellow-400',
  approved: 'bg-blue-900/40 text-blue-400',
  rejected: 'bg-gray-800 text-gray-500',
  sent:     'bg-green-900/40 text-green-400',
}

const DEFAULT_BIRTHDAY: Omit<BirthdayCampaignConfig, 'id' | 'tenant_id'> = {
  is_enabled: false,
  days_before: 3,
  email_subject: 'Happy Birthday from {restaurant_name}!',
  email_body: '<p>Hi {guest_name}! 🎂</p><p>We want to celebrate your birthday with you. Join us for a special meal at {restaurant_name}.</p><p><a href="{reserve_url}">Reserve your table</a></p>',
}

export function CampaignsClient({ initialCampaigns, initialBirthdayConfig, slug }: Props) {
  const [campaigns, setCampaigns] = useState<AiCampaign[]>(initialCampaigns)
  const [birthday, setBirthday] = useState<Omit<BirthdayCampaignConfig, 'id' | 'tenant_id'>>(
    initialBirthdayConfig || DEFAULT_BIRTHDAY
  )
  const [savingBirthday, setSavingBirthday] = useState(false)
  const [birthdaySaved, setBirthdaySaved] = useState(false)

  const [approving, setApproving] = useState<string | null>(null)
  const [editing, setEditing] = useState<AiCampaign | null>(null)
  const [editForm, setEditForm] = useState<{ subject: string; body: string; sms_body: string; channel: string }>({
    subject: '', body: '', sms_body: '', channel: 'email',
  })

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const openEdit = (c: AiCampaign) => {
    setEditing(c)
    setEditForm({ subject: c.subject || '', body: c.body || '', sms_body: c.sms_body || '', channel: c.channel || 'email' })
  }

  const approveCampaign = async () => {
    if (!editing) return
    setApproving(editing.id)
    const res = await adminFetch(`resource=campaigns&id=${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve', ...editForm }),
    })
    setApproving(null)
    if (res.ok) {
      setCampaigns(prev => prev.map(c =>
        c.id === editing.id ? { ...c, status: 'sent', ...editForm, sent_at: new Date().toISOString() } : c
      ))
      setEditing(null)
    }
  }

  const rejectCampaign = async (id: string) => {
    const res = await adminFetch(`resource=campaigns&id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' }),
    })
    if (res.ok) setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c))
  }

  const saveBirthday = async () => {
    setSavingBirthday(true)
    setBirthdaySaved(false)
    const res = await adminFetch('resource=birthday-config', {
      method: 'PATCH',
      body: JSON.stringify(birthday),
    })
    setSavingBirthday(false)
    if (res.ok) {
      setBirthdaySaved(true)
      setTimeout(() => setBirthdaySaved(false), 2500)
    }
  }

  const pending = campaigns.filter(c => c.status === 'pending')
  const rest = campaigns.filter(c => c.status !== 'pending')

  const section = (title: string) => (
    <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
      {title}
    </h2>
  )

  const CampaignCard = ({ c }: { c: AiCampaign }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] || STATUS_BADGE.pending}`}>
              {c.status}
            </span>
            <span className="text-xs text-gray-600 capitalize">{c.channel}</span>
          </div>
          {c.subject && <p className="text-sm font-medium text-white truncate">{c.subject}</p>}
          {c.segment_note && <p className="text-xs text-gray-500 mt-1">{c.segment_note}</p>}
        </div>
        <p className="text-xs text-gray-600 flex-shrink-0">
          {new Date(c.suggested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: c.body.replace(/<[^>]+>/g, ' ').trim().slice(0, 120) + (c.body.length > 120 ? '…' : '') }}
      />

      {c.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => openEdit(c)}
            className="flex-1 bg-white text-black font-semibold py-2 rounded-lg text-sm hover:bg-gray-100 transition"
          >
            Review & approve
          </button>
          <button
            onClick={() => rejectCampaign(c.id)}
            className="px-4 py-2 text-sm text-gray-500 hover:text-white border border-gray-800 rounded-lg hover:border-gray-600 transition"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="max-w-2xl space-y-10">

      {/* Pending */}
      <section>
        {section(`Pending campaigns (${pending.length})`)}
        {pending.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">No pending campaigns. The AI will suggest one when it detects an opportunity.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(c => <CampaignCard key={c.id} c={c} />)}
          </div>
        )}
      </section>

      {/* Birthday campaigns */}
      <section>
        {section('Birthday campaign')}
        <p className="text-sm text-gray-400 mb-4">
          Automatically send a birthday email to guests a few days before their birthday.
        </p>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setBirthday(b => ({ ...b, is_enabled: !b.is_enabled }))}
              className={`w-10 h-6 rounded-full transition relative ${birthday.is_enabled ? 'bg-white' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-black transition-all ${birthday.is_enabled ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm text-white">{birthday.is_enabled ? 'Enabled' : 'Disabled'}</span>
          </label>

          {birthday.is_enabled && (
            <>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Days before birthday</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={birthday.days_before}
                  onChange={e => setBirthday(b => ({ ...b, days_before: parseInt(e.target.value) || 3 }))}
                  className="w-32 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Email subject</label>
                <input
                  value={birthday.email_subject}
                  onChange={e => setBirthday(b => ({ ...b, email_subject: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none placeholder:text-gray-600"
                />
                <p className="text-xs text-gray-600 mt-1">Use {'{'+'restaurant_name}'} as placeholder</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Email body (HTML)</label>
                <textarea
                  value={birthday.email_body}
                  onChange={e => setBirthday(b => ({ ...b, email_body: e.target.value }))}
                  rows={5}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none resize-none font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Placeholders: {'{'+'guest_name}'}, {'{'+'restaurant_name}'}, {'{'+'reserve_url}'}
                </p>
              </div>
            </>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={saveBirthday}
              disabled={savingBirthday}
              className="bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
            >
              {savingBirthday ? 'Saving…' : 'Save'}
            </button>
            {birthdaySaved && <span className="text-sm text-green-400">Saved</span>}
          </div>
        </div>
      </section>

      {/* History */}
      {rest.length > 0 && (
        <section>
          {section('Campaign history')}
          <div className="space-y-3">
            {rest.map(c => <CampaignCard key={c.id} c={c} />)}
          </div>
        </section>
      )}

      {/* Edit/approve modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 my-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Review campaign</h2>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Channel</label>
                <select
                  value={editForm.channel}
                  onChange={e => setEditForm(f => ({ ...f, channel: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="email+sms">Email + SMS</option>
                </select>
              </div>
              {(editForm.channel === 'email' || editForm.channel === 'email+sms') && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Subject</label>
                    <input
                      value={editForm.subject}
                      onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Email body</label>
                    <textarea
                      value={editForm.body}
                      onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                      rows={6}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none resize-none"
                    />
                  </div>
                </>
              )}
              {(editForm.channel === 'sms' || editForm.channel === 'email+sms') && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">SMS body</label>
                  <textarea
                    value={editForm.sms_body}
                    onChange={e => setEditForm(f => ({ ...f, sms_body: e.target.value }))}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none resize-none"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={approveCampaign}
                  disabled={!!approving}
                  className="flex-1 bg-white text-black font-semibold py-3 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
                >
                  {approving ? 'Sending…' : 'Approve & send'}
                </button>
                <button onClick={() => setEditing(null)} className="px-4 py-3 text-sm text-gray-400 hover:text-white transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
