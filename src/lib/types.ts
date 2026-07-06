// src/lib/types.ts

export type UserRole = 'admin' | 'employee'
export type TenantStatus = 'trial' | 'active' | 'inactive'
export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed'
export type CampaignStatus = 'pending' | 'approved' | 'rejected' | 'sent'

export interface Profile {
  id: string           // = auth.users.id
  email: string
  full_name: string | null
  is_superadmin: boolean
  created_at: string
}

export interface Tenant {
  id: string
  slug: string
  status: TenantStatus
  trial_ends_at: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

export interface TenantMember {
  id: string
  tenant_id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface TenantSettings {
  id: string
  tenant_id: string
  name: string
  description: string | null
  address: string | null
  phone: string | null
  timezone: string
  hours_text: string | null
  instagram_url: string | null
  facebook_url: string | null
  tripadvisor_url: string | null
  yelp_url: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  background_color: string
  font_family: string
  notification_email: string
  min_party_size: number
  max_party_size: number
  min_advance_hours: number
  stripe_account_id: string | null
  ai_enabled: boolean
  website_url: string | null
  button_style: string
}

export interface TenantPhoto {
  id: string
  tenant_id: string
  url: string
  position: number
  created_at: string
}

export interface SeatingArea {
  id: string
  tenant_id: string
  name: string
  position: number
  is_active: boolean
  created_at: string
}

export interface Shift {
  id: string
  tenant_id: string
  day_of_week: number
  name: string
  start_time: string
  end_time: string
  interval_minutes: number
  duration_minutes: number
  is_active: boolean
  created_at: string
  shift_areas?: ShiftArea[]
}

export interface ShiftArea {
  id: string
  tenant_id: string
  shift_id: string
  seating_area_id: string
  capacity: number
  seating_areas?: SeatingArea
}

export interface BlockedDate {
  id: string
  tenant_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface SpecialEvent {
  id: string
  tenant_id: string
  name: string
  date: string
  deposit_amount: number
  refund_cutoff_hours: number
  created_at: string
}

export interface Guest {
  id: string
  tenant_id: string
  email: string
  name: string
  phone: string | null
  birthday: string | null
  notes: string | null
  visit_count: number
  last_visit_at: string | null
  created_at: string
  tags?: string[]
}

export interface Reservation {
  id: string
  tenant_id: string
  shift_id: string
  guest_id: string
  seating_area_id: string | null
  date: string
  time: string
  party_size: number
  occasion: string | null
  notes: string | null
  status: ReservationStatus
  cancellation_token: string
  cancelled_at: string | null
  deposit_amount: number | null
  stripe_payment_intent: string | null
  deposit_refunded: boolean | null
  created_at: string
  guest?: Guest
  seating_area?: SeatingArea
  shift?: Shift
}

export interface BirthdayCampaignConfig {
  id: string
  tenant_id: string
  is_enabled: boolean
  days_before: number
  email_subject: string
  email_body: string
}

export interface AiCampaign {
  id: string
  tenant_id: string
  target_date: string
  suggested_at: string
  status: CampaignStatus
  channel: string
  subject: string | null
  body: string
  sms_body: string | null
  segment_note: string | null
  approved_at: string | null
  sent_at: string | null
  created_at: string
}

export interface Referral {
  id: string
  referrer_tenant_id: string
  referred_tenant_id: string
  created_at: string
  referrer_coupon_id: string | null
  referred_coupon_id: string | null
}

export interface DepositRule {
  id: string
  tenant_id: string
  rule_type: 'all_days' | 'day_of_week' | 'specific_date'
  day_of_week: number | null
  specific_date: string | null
  amount_cents: number
  refund_cutoff_hours: number
}

export interface AvailabilitySlot {
  shift_id: string
  shift_name: string
  time: string
  areas: { area_id: string; area_name: string; available_capacity: number }[]
}

export interface TenantContext {
  tenant: Tenant
  settings: TenantSettings
}
