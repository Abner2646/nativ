'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { DepositRule } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  initialRules: DepositRule[]
  stripeAccountId: string | null
  slug: string
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-widest text-offwhite/30 mb-1.5">
      {children}
    </label>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
      style={{
        backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? 'rgba(242,239,233,1)' : 'rgba(242,239,233,0.40)',
      }}
    >
      {children}
    </button>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm text-offwhite outline-none"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', colorScheme: 'dark' }}
    />
  )
}

function ruleLabel(r: DepositRule) {
  if (r.rule_type === 'all_days') return 'Every day'
  if (r.rule_type === 'day_of_week') return `Every ${DAY_NAMES[r.day_of_week!]}`
  return r.specific_date!
}

export function DepositRulesClient({ initialRules, stripeAccountId, slug }: Props) {
  const [rules, setRules]         = useState<DepositRule[]>(initialRules)
  const [stripeId, setStripeId]   = useState(stripeAccountId)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError]     = useState('')

  const [ruleType, setRuleType]       = useState<'all_days' | 'day_of_week' | 'specific_date'>('day_of_week')
  const [dayOfWeek, setDayOfWeek]     = useState(6)
  const [specificDate, setSpecificDate] = useState('')
  const [amountDollars, setAmountDollars] = useState('')
  const [refundCutoff, setRefundCutoff]   = useState('24')
  const [adding, setAdding]   = useState(false)
  const [addError, setAddError] = useState('')
  const [pendingDeleteRule, setPendingDeleteRule] = useState<{ id: string; label: string } | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)

  const handleConnect = async () => {
    setConnectLoading(true); setConnectError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=stripe-connect&tenant=${slug}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setConnectError(data.error || 'Failed'); setConnectLoading(false); return }
      window.location.href = data.url
    } catch {
      setConnectError('Network error')
      setConnectLoading(false)
    }
  }

  const handleAddRule = async () => {
    const cents = Math.round(parseFloat(amountDollars) * 100)
    if (isNaN(cents) || cents < 50) { setAddError('Minimum amount is $0.50'); return }
    if (ruleType === 'specific_date' && !specificDate) { setAddError('Select a date'); return }

    setAdding(true); setAddError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=deposit-rules&tenant=${slug}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_type: ruleType,
          day_of_week: ruleType === 'day_of_week' ? dayOfWeek : null,
          specific_date: ruleType === 'specific_date' ? specificDate : null,
          amount_cents: cents,
          refund_cutoff_hours: parseInt(refundCutoff) || 24,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Failed'); return }
      setRules(prev => [...prev, data.rule])
      setAmountDollars('')
      setSpecificDate('')
      toast.success('Deposit rule added')
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  const doDeleteRule = async () => {
    if (!pendingDeleteRule) return
    setDeletingRule(true)
    const token = await getToken()
    const res = await fetch(`/api/admin?resource=deposit-rules&id=${pendingDeleteRule.id}&tenant=${slug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setDeletingRule(false)
    if (res.ok) { setRules(prev => prev.filter(r => r.id !== pendingDeleteRule.id)); toast.success('Rule removed') }
    else toast.error('Failed to remove rule')
    setPendingDeleteRule(null)
  }

  return (
    <div style={{ maxWidth: '36rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <ConfirmModal
        open={!!pendingDeleteRule}
        title="Remove deposit rule?"
        message={pendingDeleteRule ? `"${pendingDeleteRule.label}" will no longer require a deposit.` : undefined}
        confirmLabel="Remove rule"
        destructive
        loading={deletingRule}
        onConfirm={doDeleteRule}
        onCancel={() => setPendingDeleteRule(null)}
      />

      {/* ── Stripe Connect ── */}
      <Card>
        <h2 className="text-sm font-semibold text-offwhite mb-1">Stripe Connect</h2>
        <p className="text-xs text-offwhite/40 mb-4">
          Connect your Stripe account to receive deposits directly — Nativ never touches the money.
        </p>
        {stripeId ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full font-semibold">
              Connected
            </span>
            <span className="text-xs text-offwhite/25 font-mono">{stripeId}</span>
          </div>
        ) : (
          <div>
            <button
              onClick={handleConnect}
              disabled={connectLoading}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-offwhite disabled:opacity-40 transition-colors hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {connectLoading ? 'Loading…' : 'Connect with Stripe →'}
            </button>
            {connectError && <p className="text-xs text-red-400 mt-2">{connectError}</p>}
          </div>
        )}
      </Card>

      {/* ── Deposit Rules ── */}
      <Card>
        <h2 className="text-sm font-semibold text-offwhite mb-1">Deposit rules</h2>
        <p className="text-xs text-offwhite/40 mb-4">
          Require a deposit to confirm a reservation. Rules are matched in order: specific date &gt; day of week &gt; all days.
        </p>

        {/* Existing rules */}
        {rules.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {rules.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="min-w-0">
                  <span className="text-sm text-offwhite font-medium">{ruleLabel(r)}</span>
                  <span className="text-xs text-offwhite/35 ml-2">
                    ${(r.amount_cents / 100).toFixed(2)} · refund within {r.refund_cutoff_hours}h
                  </span>
                </div>
                <button
                  onClick={() => setPendingDeleteRule({ id: r.id, label: ruleLabel(r) })}
                  className="text-xs text-red-400/50 hover:text-red-400 transition-colors ml-3 shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add rule form */}
        <div className="flex flex-col gap-3 pt-3" style={{ borderTop: rules.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div>
            <SectionLabel>When</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              <Pill active={ruleType === 'all_days'}      onClick={() => setRuleType('all_days')}>All days</Pill>
              <Pill active={ruleType === 'day_of_week'}   onClick={() => setRuleType('day_of_week')}>Day of week</Pill>
              <Pill active={ruleType === 'specific_date'} onClick={() => setRuleType('specific_date')}>Specific date</Pill>
            </div>
          </div>

          {ruleType === 'day_of_week' && (
            <div>
              <SectionLabel>Day</SectionLabel>
              <div className="flex gap-1 flex-wrap">
                {DAY_NAMES.map((name, i) => (
                  <Pill key={i} active={dayOfWeek === i} onClick={() => setDayOfWeek(i)}>
                    {name.slice(0, 3)}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {ruleType === 'specific_date' && (
            <div>
              <SectionLabel>Date</SectionLabel>
              <TextInput
                type="date"
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel>Amount (USD)</SectionLabel>
              <TextInput
                type="number"
                min="0.50"
                step="0.01"
                value={amountDollars}
                onChange={e => setAmountDollars(e.target.value)}
                placeholder="e.g. 25.00"
              />
            </div>
            <div>
              <SectionLabel>Refund cutoff (hours)</SectionLabel>
              <TextInput
                type="number"
                min="0"
                value={refundCutoff}
                onChange={e => setRefundCutoff(e.target.value)}
                placeholder="24"
              />
            </div>
          </div>

          {addError && <p className="text-xs text-red-400">{addError}</p>}

          <button
            onClick={handleAddRule}
            disabled={adding || !amountDollars}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-offwhite disabled:opacity-40 transition-colors hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {adding ? 'Adding…' : 'Add rule'}
          </button>
        </div>
      </Card>
    </div>
  )
}
