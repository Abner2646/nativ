-- ============================================================
-- 013 — Reschedule: mover una reserva existente
--
-- Cambia fecha/hora/party/área re-asignando mesa atómicamente.
-- Mismo advisory lock que el booking. El check de overlap EXCLUYE
-- los assignments propios: mover una reserva 30 min en su misma
-- mesa no debe chocar consigo misma.
-- ============================================================

create or replace function reschedule_reservation(
  p_tenant_id        uuid,
  p_reservation_id   uuid,
  p_shift_id         uuid,
  p_area_id          uuid,
  p_date             date,
  p_time             time,
  p_duration_minutes integer,
  p_party_size       integer,
  p_occasion         text default null,
  p_notes            text default null,
  p_use_tables       boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res            record;
  v_table_id       uuid;
  v_table_name     text;
  v_combo_id       uuid;
  v_combo_name     text;
  v_start          timestamp;
  v_end            timestamp;
  v_member         record;
begin
  select * into v_res from reservations
  where id = p_reservation_id and tenant_id = p_tenant_id;

  if v_res.id is null then
    raise exception 'reservation_not_found';
  end if;
  if v_res.status != 'confirmed' then
    raise exception 'reservation_not_confirmed';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_area_id::text || '|' || p_date::text));

  v_start := p_date + p_time;
  v_end   := v_start + make_interval(mins => p_duration_minutes);

  if p_use_tables then
    -- Mesa individual best-fit (ignorando los assignments de ESTA reserva)
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
          and ta.reservation_id != p_reservation_id
          and r.date = p_date
          and r.status = 'confirmed'
          and (r.date + r.time) < v_end
          and (r.date + r.time + make_interval(mins => coalesce(r.duration_minutes, s.duration_minutes))) > v_start
      )
    order by t.max_covers asc, t.created_at asc
    limit 1;

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
                and ta.reservation_id != p_reservation_id
                and r.date = p_date
                and r.status = 'confirmed'
                and (r.date + r.time) < v_end
                and (r.date + r.time + make_interval(mins => coalesce(r.duration_minutes, s.duration_minutes))) > v_start
            )
        )
      order by c.max_covers asc, c.created_at asc
      limit 1;

      if v_combo_id is null then
        raise exception 'no_table_available';
      end if;
    end if;
  end if;

  -- Aplicar el cambio
  update reservations set
    shift_id         = p_shift_id,
    seating_area_id  = p_area_id,
    date             = p_date,
    time             = p_time,
    party_size       = p_party_size,
    duration_minutes = p_duration_minutes,
    occasion         = p_occasion,
    notes            = p_notes,
    seated_at        = null  -- si estaba sentada y se mueve, vuelve a "reservada"
  where id = p_reservation_id;

  delete from table_assignments where reservation_id = p_reservation_id;

  if p_use_tables then
    if v_table_id is not null then
      insert into table_assignments (tenant_id, reservation_id, table_id)
      values (p_tenant_id, p_reservation_id, v_table_id);
    else
      for v_member in
        select table_id from table_combination_members where combination_id = v_combo_id
      loop
        insert into table_assignments (tenant_id, reservation_id, table_id)
        values (p_tenant_id, p_reservation_id, v_member.table_id);
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'table_name',     coalesce(v_table_name, v_combo_name)
  );
end;
$$;

revoke execute on function reschedule_reservation from public, anon, authenticated;
