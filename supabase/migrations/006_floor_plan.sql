-- ============================================================
-- 006 — Floor plan: mesas físicas + asignaciones
-- Fase 1: modelo de datos. El motor de disponibilidad por mesas
-- llega en fase 2; mientras tanto estas tablas no afectan booking.
-- ============================================================

-- ── RESTAURANT TABLES ─────────────────────────────────────────
create table restaurant_tables (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  seating_area_id  uuid not null references seating_areas(id) on delete cascade,
  name             text not null,
  shape            text not null default 'square' check (shape in ('round', 'square', 'rect')),
  min_covers       integer not null default 1 check (min_covers >= 1),
  max_covers       integer not null default 4 check (max_covers >= min_covers),
  -- Posición y tamaño en unidades de grilla abstractas (0–100)
  -- para que el plano escale a cualquier pantalla
  x                real not null default 40,
  y                real not null default 40,
  width            real not null default 10,
  height           real not null default 10,
  rotation         integer not null default 0 check (rotation in (0, 45, 90, 135)),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint unique_table_name_per_area unique (seating_area_id, name)
);

-- ── TABLE ASSIGNMENTS ─────────────────────────────────────────
-- Una fila por mesa asignada a una reserva.
-- Dos filas con la misma reservation_id = combo de mesas.
create table table_assignments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  reservation_id  uuid not null references reservations(id) on delete cascade,
  table_id        uuid not null references restaurant_tables(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint unique_reservation_table unique (reservation_id, table_id)
);

-- ── RESERVATIONS: columnas de servicio ────────────────────────
alter table reservations add column seated_at   timestamptz;
alter table reservations add column finished_at timestamptz;
alter table reservations add column source      text not null default 'online'
  check (source in ('online', 'walk_in', 'manual'));

-- ── INDEXES ───────────────────────────────────────────────────
create index idx_restaurant_tables_tenant on restaurant_tables(tenant_id);
create index idx_restaurant_tables_area   on restaurant_tables(seating_area_id) where is_active;
create index idx_table_assignments_tenant on table_assignments(tenant_id);
create index idx_table_assignments_res    on table_assignments(reservation_id);
create index idx_table_assignments_table  on table_assignments(table_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Igual que el resto del schema: acceso via service_role en el backend.
alter table restaurant_tables enable row level security;
alter table table_assignments enable row level security;
