-- ============================================================
-- 009 — Combinaciones de mesas (fase 4)
--
-- Parties que no entran en ninguna mesa individual pueden
-- reservar un combo (T1+T2). El booking online intenta primero
-- mesas individuales (best-fit) y cae a combos si no hay.
-- ============================================================

-- ── COMBINATIONS ──────────────────────────────────────────────
create table table_combinations (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  seating_area_id  uuid not null references seating_areas(id) on delete cascade,
  name             text not null,
  min_covers       integer not null default 1 check (min_covers >= 1),
  max_covers       integer not null check (max_covers >= min_covers),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table table_combination_members (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  combination_id   uuid not null references table_combinations(id) on delete cascade,
  table_id         uuid not null references restaurant_tables(id) on delete cascade,
  constraint unique_combo_member unique (combination_id, table_id)
);

create index idx_combinations_tenant on table_combinations(tenant_id);
create index idx_combinations_area   on table_combinations(seating_area_id) where is_active;
create index idx_combo_members_combo on table_combination_members(combination_id);
create index idx_combo_members_table on table_combination_members(table_id);

-- Si al borrar una mesa un combo queda con menos de 2 miembros,
-- el combo ya no tiene sentido: se elimina solo.
create or replace function cleanup_orphan_combinations()
returns trigger as $$
begin
  delete from table_combinations c
  where c.id = old.combination_id
    and (select count(*) from table_combination_members m where m.combination_id = c.id) < 2;
  return old;
end;
$$ language plpgsql;

create trigger trg_cleanup_combos
  after delete on table_combination_members
  for each row execute function cleanup_orphan_combinations();

alter table table_combinations        enable row level security;
alter table table_combination_members enable row level security;

-- ── BOOKING v2: mesas individuales primero, combos después ────
create or replace function book_reservation_with_table(
  p_tenant_id             uuid,
  p_shift_id              uuid,
  p_guest_id              uuid,
  p_area_id               uuid,
  p_date                  date,
  p_time                  time,
  p_duration_minutes      integer,
  p_party_size            integer,
  p_occasion              text default null,
  p_notes                 text default null,
  p_source                text default 'online',
  p_deposit_amount        numeric default null,
  p_stripe_payment_intent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id       uuid;
  v_table_name     text;
  v_combo_id       uuid;
  v_combo_name     text;
  v_reservation_id uuid;
  v_start          timestamp;
  v_end            timestamp;
  v_member         record;
begin
  perform pg_advisory_xact_lock(hashtext(p_area_id::text || '|' || p_date::text));

  v_start := p_date + p_time;
  v_end   := v_start + make_interval(mins => p_duration_minutes);

  -- 1) Mesa individual, best-fit
  select t.id, t.name into v_table_id, v_table_name
  from restaurant_tables t
  where t.tenant_id = p_tenant_id
    and t.seating_area_id = p_area_id
    and t.is_active
    and t.min_covers <= p_party_size
    and t.max_covers >= p_party_size
    and not exists (
      select 1
      from table_assignments ta
      join reservations r on r.id = ta.reservation_id
      join shifts s       on s.id = r.shift_id
      where ta.table_id = t.id
        and r.date = p_date
        and r.status = 'confirmed'
        and (r.date + r.time) < v_end
        and (r.date + r.time + make_interval(mins => s.duration_minutes)) > v_start
    )
  order by t.max_covers asc, t.created_at asc
  limit 1;

  -- 2) Sin mesa individual: combo best-fit con TODOS sus miembros libres y activos
  if v_table_id is null then
    select c.id, c.name into v_combo_id, v_combo_name
    from table_combinations c
    where c.tenant_id = p_tenant_id
      and c.seating_area_id = p_area_id
      and c.is_active
      and c.min_covers <= p_party_size
      and c.max_covers >= p_party_size
      and not exists (
        select 1 from table_combination_members m
        join restaurant_tables rt on rt.id = m.table_id
        where m.combination_id = c.id and not rt.is_active
      )
      and not exists (
        select 1
        from table_combination_members m
        where m.combination_id = c.id
          and exists (
            select 1
            from table_assignments ta
            join reservations r on r.id = ta.reservation_id
            join shifts s       on s.id = r.shift_id
            where ta.table_id = m.table_id
              and r.date = p_date
              and r.status = 'confirmed'
              and (r.date + r.time) < v_end
              and (r.date + r.time + make_interval(mins => s.duration_minutes)) > v_start
          )
      )
    order by c.max_covers asc, c.created_at asc
    limit 1;

    if v_combo_id is null then
      raise exception 'no_table_available';
    end if;
  end if;

  insert into reservations (
    tenant_id, shift_id, guest_id, seating_area_id,
    date, time, party_size, occasion, notes, status, source,
    deposit_amount, stripe_payment_intent
  ) values (
    p_tenant_id, p_shift_id, p_guest_id, p_area_id,
    p_date, p_time, p_party_size, p_occasion, p_notes, 'confirmed', p_source,
    p_deposit_amount, p_stripe_payment_intent
  ) returning id into v_reservation_id;

  if v_table_id is not null then
    insert into table_assignments (tenant_id, reservation_id, table_id)
    values (p_tenant_id, v_reservation_id, v_table_id);
  else
    for v_member in
      select table_id from table_combination_members where combination_id = v_combo_id
    loop
      insert into table_assignments (tenant_id, reservation_id, table_id)
      values (p_tenant_id, v_reservation_id, v_member.table_id);
    end loop;
  end if;

  return jsonb_build_object(
    'reservation_id', v_reservation_id,
    'table_id',       v_table_id,
    'table_name',     coalesce(v_table_name, v_combo_name)
  );
end;
$$;

-- ── ASSIGN v2: acepta varias mesas (combo manual o mover) ─────
create or replace function assign_reservation_tables(
  p_tenant_id      uuid,
  p_reservation_id uuid,
  p_table_ids      uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res       record;
  v_table     record;
  v_area_id   uuid;
  v_max_total integer := 0;
  v_start     timestamp;
  v_end       timestamp;
  v_tid       uuid;
begin
  if array_length(p_table_ids, 1) is null then
    raise exception 'no_tables_given';
  end if;

  select r.*, s.duration_minutes into v_res
  from reservations r
  join shifts s on s.id = r.shift_id
  where r.id = p_reservation_id and r.tenant_id = p_tenant_id;

  if v_res.id is null then
    raise exception 'reservation_not_found';
  end if;
  if v_res.status != 'confirmed' then
    raise exception 'reservation_not_confirmed';
  end if;

  -- Todas las mesas deben existir, estar activas y ser del mismo área
  for v_tid in select unnest(p_table_ids) loop
    select * into v_table
    from restaurant_tables
    where id = v_tid and tenant_id = p_tenant_id and is_active;
    if v_table.id is null then
      raise exception 'table_not_found';
    end if;
    if v_area_id is null then
      v_area_id := v_table.seating_area_id;
    elsif v_area_id != v_table.seating_area_id then
      raise exception 'tables_in_different_areas';
    end if;
    v_max_total := v_max_total + v_table.max_covers;
  end loop;

  perform pg_advisory_xact_lock(hashtext(v_area_id::text || '|' || v_res.date::text));

  if v_res.party_size > v_max_total then
    raise exception 'party_too_large';
  end if;

  v_start := v_res.date + v_res.time;
  v_end   := v_start + make_interval(mins => v_res.duration_minutes);

  if exists (
    select 1
    from table_assignments ta
    join reservations r on r.id = ta.reservation_id
    join shifts s       on s.id = r.shift_id
    where ta.table_id = any(p_table_ids)
      and ta.reservation_id != p_reservation_id
      and r.date = v_res.date
      and r.status = 'confirmed'
      and (r.date + r.time) < v_end
      and (r.date + r.time + make_interval(mins => s.duration_minutes)) > v_start
  ) then
    raise exception 'table_occupied';
  end if;

  delete from table_assignments where reservation_id = p_reservation_id;

  for v_tid in select unnest(p_table_ids) loop
    insert into table_assignments (tenant_id, reservation_id, table_id)
    values (p_tenant_id, p_reservation_id, v_tid);
  end loop;

  update reservations set seating_area_id = v_area_id
  where id = p_reservation_id;

  return jsonb_build_object('reservation_id', p_reservation_id, 'table_ids', p_table_ids);
end;
$$;

-- La versión mono-mesa queda obsoleta
drop function if exists assign_reservation_table(uuid, uuid, uuid);

revoke execute on function book_reservation_with_table from public, anon, authenticated;
revoke execute on function assign_reservation_tables from public, anon, authenticated;
