-- ============================================================
-- NATIV v2 — Database Schema
-- Multi-tenant SaaS con Supabase Auth
-- ============================================================

create extension if not exists "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────
create type reservation_status as enum ('confirmed', 'cancelled', 'completed');
create type tenant_member_role as enum ('admin', 'employee');
create type tenant_status      as enum ('trial', 'active', 'inactive');
create type campaign_status    as enum ('pending', 'approved', 'rejected', 'sent');

-- ── PROFILES (extiende auth.users de Supabase) ───────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Trigger para crear perfil automáticamente cuando se registra un usuario
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── TENANTS ──────────────────────────────────────────────────
create table tenants (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  status                 tenant_status not null default 'trial',
  trial_ends_at          timestamptz not null default now() + interval '14 days',
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz not null default now()
);

-- ── TENANT MEMBERS (relación user <-> tenant con rol) ────────
create table tenant_members (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        tenant_member_role not null default 'employee',
  created_at  timestamptz not null default now(),
  constraint unique_member unique (tenant_id, user_id)
);

-- ── EMPLOYEE INVITES ──────────────────────────────────────────
create table employee_invites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  token       uuid not null default gen_random_uuid(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint unique_invite unique (tenant_id, email)
);

-- ── TENANT SETTINGS ──────────────────────────────────────────
create table tenant_settings (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  name               text not null default '',
  description        text,
  address            text,
  phone              text,
  timezone           text not null default 'America/New_York',
  hours_text         text,
  instagram_url      text,
  facebook_url       text,
  tripadvisor_url    text,
  yelp_url           text,
  logo_url           text,
  primary_color      text not null default '#000000',
  secondary_color    text not null default '#666666',
  background_color   text not null default '#ffffff',
  font_family        text not null default 'Inter',
  notification_email text not null default '',
  min_party_size     integer not null default 1,
  max_party_size     integer not null default 10,
  min_advance_hours  integer not null default 2,
  stripe_account_id  text,
  ai_enabled         boolean not null default true,
  constraint one_per_tenant unique (tenant_id)
);

-- ── TENANT PHOTOS ─────────────────────────────────────────────
create table tenant_photos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  url         text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── SEATING AREAS ─────────────────────────────────────────────
create table seating_areas (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── SHIFTS ───────────────────────────────────────────────────
create table shifts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  day_of_week       integer not null check (day_of_week between 0 and 6),
  name              text not null,
  start_time        time not null,
  end_time          time not null,
  interval_minutes  integer not null default 30,
  duration_minutes  integer not null default 90,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ── SHIFT AREAS ───────────────────────────────────────────────
create table shift_areas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  shift_id         uuid not null references shifts(id) on delete cascade,
  seating_area_id  uuid not null references seating_areas(id) on delete cascade,
  capacity         integer not null default 0,
  constraint unique_shift_area unique (shift_id, seating_area_id)
);

-- ── BLOCKED DATES ─────────────────────────────────────────────
create table blocked_dates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  date        date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  constraint unique_tenant_date unique (tenant_id, date)
);

-- ── SPECIAL EVENTS (con seña) ─────────────────────────────────
create table special_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  date                date not null,
  deposit_amount      integer not null,
  refund_cutoff_hours integer not null default 24,
  created_at          timestamptz not null default now()
);

-- ── GUESTS ───────────────────────────────────────────────────
create table guests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  email         text not null,
  name          text not null,
  phone         text,
  birthday      date,
  notes         text,
  visit_count   integer not null default 0,
  last_visit_at date,
  created_at    timestamptz not null default now(),
  constraint unique_tenant_guest unique (tenant_id, email)
);

-- ── GUEST TAGS ────────────────────────────────────────────────
create table guest_tags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  guest_id    uuid not null references guests(id) on delete cascade,
  tag         text not null,
  created_at  timestamptz not null default now(),
  constraint unique_guest_tag unique (guest_id, tag)
);

-- ── RESERVATIONS ──────────────────────────────────────────────
create table reservations (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  shift_id             uuid not null references shifts(id),
  guest_id             uuid not null references guests(id),
  seating_area_id      uuid references seating_areas(id),
  date                 date not null,
  time                 time not null,
  party_size           integer not null,
  occasion             text,
  notes                text,
  status               reservation_status not null default 'confirmed',
  cancellation_token   uuid not null default gen_random_uuid(),
  cancelled_at         timestamptz,
  deposit_amount       integer,
  stripe_payment_intent text,
  deposit_refunded     boolean default false,
  created_at           timestamptz not null default now()
);

-- ── BIRTHDAY CAMPAIGN CONFIG ──────────────────────────────────
create table birthday_campaign_config (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  is_enabled    boolean not null default false,
  days_before   integer not null default 7,
  email_subject text not null default 'Happy Birthday from {restaurant_name}!',
  email_body    text not null default '<p>Hi {guest_name}, we''d love to celebrate with you!</p><p><a href="{reserve_url}">Reserve a Table</a></p>',
  constraint one_per_tenant unique (tenant_id)
);

-- ── AI CAMPAIGNS ──────────────────────────────────────────────
create table ai_campaigns (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  target_date  date not null,
  suggested_at timestamptz not null default now(),
  status       campaign_status not null default 'pending',
  channel      text not null default 'email',
  subject      text,
  body         text not null,
  sms_body     text,
  segment_note text,
  approved_at  timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ── REFERRALS ─────────────────────────────────────────────────
create table referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_tenant_id   uuid not null references tenants(id),
  referred_tenant_id   uuid not null references tenants(id),
  referrer_coupon_id   text,
  referred_coupon_id   text,
  created_at           timestamptz not null default now(),
  constraint unique_referral unique (referrer_tenant_id, referred_tenant_id)
);

-- ── INDEXES ───────────────────────────────────────────────────
create index idx_profiles_id on profiles(id);
create index idx_tenant_members_user on tenant_members(user_id);
create index idx_tenant_members_tenant on tenant_members(tenant_id);
create index idx_employee_invites_token on employee_invites(token);
create index idx_tenants_slug on tenants(slug);
create index idx_shifts_tenant_day on shifts(tenant_id, day_of_week);
create index idx_blocked_dates_tenant_date on blocked_dates(tenant_id, date);
create index idx_guests_tenant_email on guests(tenant_id, email);
create index idx_reservations_tenant_date on reservations(tenant_id, date);
create index idx_reservations_shift_date on reservations(shift_id, date, status);
create index idx_reservations_token on reservations(cancellation_token);
create index idx_ai_campaigns_tenant_status on ai_campaigns(tenant_id, status);

-- ── TRIGGER: visit_count en guests ───────────────────────────
create or replace function update_guest_stats()
returns trigger as $$
begin
  if NEW.status = 'completed' and (OLD.status is null or OLD.status != 'completed') then
    update guests set
      visit_count = visit_count + 1,
      last_visit_at = NEW.date
    where id = NEW.guest_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_guest_stats
  after insert or update on reservations
  for each row execute function update_guest_stats();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table profiles              enable row level security;
alter table tenants               enable row level security;
alter table tenant_members        enable row level security;
alter table employee_invites      enable row level security;
alter table tenant_settings       enable row level security;
alter table tenant_photos         enable row level security;
alter table seating_areas         enable row level security;
alter table shifts                enable row level security;
alter table shift_areas           enable row level security;
alter table blocked_dates         enable row level security;
alter table special_events        enable row level security;
alter table guests                enable row level security;
alter table guest_tags            enable row level security;
alter table reservations          enable row level security;
alter table birthday_campaign_config enable row level security;
alter table ai_campaigns          enable row level security;
alter table referrals             enable row level security;

-- Profiles: cada usuario ve y edita solo el suyo
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Reservations: público puede insertar y leer por token (via API)
create policy "Public can create reservations"
  on reservations for insert with check (true);
create policy "Public can read reservations"
  on reservations for select using (true);
create policy "Public can update reservations"
  on reservations for update using (true);

-- Todo lo demás va por service_role en el backend
