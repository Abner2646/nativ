-- ============================================================
-- 011 — Waitlist para walk-ins sin mesa libre
-- ============================================================

create table waitlist_entries (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  phone           text,
  party_size      integer not null check (party_size >= 1),
  quoted_minutes  integer,
  status          text not null default 'waiting' check (status in ('waiting', 'seated', 'removed')),
  created_at      timestamptz not null default now(),
  seated_at       timestamptz
);

create index idx_waitlist_tenant_status on waitlist_entries(tenant_id, status);
alter table waitlist_entries enable row level security;

create policy "Authenticated can read waitlist"
  on waitlist_entries for select
  to authenticated
  using (true);

alter publication supabase_realtime add table waitlist_entries;
