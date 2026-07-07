-- ============================================================
-- 008 — Vista de servicio (fase 3)
--
-- Dos RPCs que toman el MISMO advisory lock (área + fecha) que
-- book_reservation_with_table, para que walk-ins y asignaciones
-- manuales no corran carreras contra bookings online.
-- ============================================================

-- ── Walk-in: sentar a alguien en una mesa concreta ────────────
create or replace function seat_walk_in(
  p_tenant_id        uuid,
  p_table_id         uuid,
  p_guest_id         uuid,
  p_shift_id         uuid,
  p_date             date,
  p_time             time,
  p_duration_minutes integer,
  p_party_size       integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table          record;
  v_reservation_id uuid;
  v_start          timestamp;
  v_end            timestamp;
begin
  select * into v_table
  from restaurant_tables
  where id = p_table_id and tenant_id = p_tenant_id and is_active;

  if v_table.id is null then
    raise exception 'table_not_found';
  end if;

  -- Mismo lock que el booking online
  perform pg_advisory_xact_lock(hashtext(v_table.seating_area_id::text || '|' || p_date::text));

  -- Solo se valida el máximo: el host puede sentar 1 persona en una
  -- mesa de 4 si quiere — el mínimo es una regla para bookings online.
  if p_party_size > v_table.max_covers then
    raise exception 'party_too_large';
  end if;

  v_start := p_date + p_time;
  v_end   := v_start + make_interval(mins => p_duration_minutes);

  if exists (
    select 1
    from table_assignments ta
    join reservations r on r.id = ta.reservation_id
    join shifts s       on s.id = r.shift_id
    where ta.table_id = p_table_id
      and r.date = p_date
      and r.status = 'confirmed'
      and (r.date + r.time) < v_end
      and (r.date + r.time + make_interval(mins => s.duration_minutes)) > v_start
  ) then
    raise exception 'table_occupied';
  end if;

  insert into reservations (
    tenant_id, shift_id, guest_id, seating_area_id,
    date, time, party_size, status, source, seated_at
  ) values (
    p_tenant_id, p_shift_id, p_guest_id, v_table.seating_area_id,
    p_date, p_time, p_party_size, 'confirmed', 'walk_in', now()
  ) returning id into v_reservation_id;

  insert into table_assignments (tenant_id, reservation_id, table_id)
  values (p_tenant_id, v_reservation_id, p_table_id);

  return jsonb_build_object('reservation_id', v_reservation_id, 'table_id', p_table_id);
end;
$$;

-- ── Asignar (o mover) una reserva a una mesa concreta ─────────
create or replace function assign_reservation_table(
  p_tenant_id      uuid,
  p_reservation_id uuid,
  p_table_id       uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res   record;
  v_table record;
  v_dur   integer;
  v_start timestamp;
  v_end   timestamp;
begin
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

  select * into v_table
  from restaurant_tables
  where id = p_table_id and tenant_id = p_tenant_id and is_active;

  if v_table.id is null then
    raise exception 'table_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_table.seating_area_id::text || '|' || v_res.date::text));

  if v_res.party_size > v_table.max_covers then
    raise exception 'party_too_large';
  end if;

  v_dur   := v_res.duration_minutes;
  v_start := v_res.date + v_res.time;
  v_end   := v_start + make_interval(mins => v_dur);

  if exists (
    select 1
    from table_assignments ta
    join reservations r on r.id = ta.reservation_id
    join shifts s       on s.id = r.shift_id
    where ta.table_id = p_table_id
      and ta.reservation_id != p_reservation_id
      and r.date = v_res.date
      and r.status = 'confirmed'
      and (r.date + r.time) < v_end
      and (r.date + r.time + make_interval(mins => s.duration_minutes)) > v_start
  ) then
    raise exception 'table_occupied';
  end if;

  -- Mover: reemplaza cualquier asignación previa de esta reserva
  delete from table_assignments where reservation_id = p_reservation_id;

  insert into table_assignments (tenant_id, reservation_id, table_id)
  values (p_tenant_id, p_reservation_id, p_table_id);

  -- El área de la reserva sigue a la mesa (decisión del host)
  update reservations set seating_area_id = v_table.seating_area_id
  where id = p_reservation_id;

  return jsonb_build_object('reservation_id', p_reservation_id, 'table_id', p_table_id);
end;
$$;

revoke execute on function seat_walk_in from public, anon, authenticated;
revoke execute on function assign_reservation_table from public, anon, authenticated;

-- ── Realtime para la vista de servicio ────────────────────────
-- El cliente se suscribe a cambios y refetchea el estado.
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table table_assignments;
alter publication supabase_realtime add table restaurant_tables;

-- Realtime respeta RLS: reservations ya tiene select público (via API),
-- assignments y tables necesitan policy para que los eventos lleguen
-- a clientes autenticados del dashboard.
create policy "Authenticated can read assignments"
  on table_assignments for select
  to authenticated
  using (true);

create policy "Authenticated can read tables"
  on restaurant_tables for select
  to authenticated
  using (true);
