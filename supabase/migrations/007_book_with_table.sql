-- ============================================================
-- 007 — RPC: reserva + asignación de mesa atómica (fase 2)
--
-- Serializa bookings concurrentes por (área, fecha) con un
-- advisory lock transaccional. FOR UPDATE no alcanza acá: el
-- conflicto nace de INSERTs en table_assignments (no de updates
-- sobre la mesa), así que dos transacciones podrían elegir la
-- misma mesa con snapshots viejos. El advisory lock hace que la
-- segunda espere al commit de la primera y vea su assignment.
-- ============================================================

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
  v_reservation_id uuid;
  v_start          timestamp;
  v_end            timestamp;
begin
  -- Serializar por área + fecha
  perform pg_advisory_xact_lock(hashtext(p_area_id::text || '|' || p_date::text));

  v_start := p_date + p_time;
  v_end   := v_start + make_interval(mins => p_duration_minutes);

  -- Best-fit: la mesa libre más chica donde entre el party.
  -- Libre = sin assignment de reserva confirmada cuya ventana
  -- [time, time + duración de su shift) se solape con la nuestra.
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

  if v_table_id is null then
    raise exception 'no_table_available';
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

  insert into table_assignments (tenant_id, reservation_id, table_id)
  values (p_tenant_id, v_reservation_id, v_table_id);

  return jsonb_build_object(
    'reservation_id', v_reservation_id,
    'table_id',       v_table_id,
    'table_name',     v_table_name
  );
end;
$$;

-- Solo el backend (service_role) puede ejecutarla
revoke execute on function book_reservation_with_table from public, anon, authenticated;
