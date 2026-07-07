-- ============================================================
-- 012 — FK tenant_members → profiles
--
-- La página de Employees embebe profiles desde tenant_members,
-- pero user_id solo referenciaba auth.users: PostgREST no
-- encontraba relación (PGRST200) y la lista quedaba vacía
-- desde el schema inicial. profiles.id ya cascadea desde
-- auth.users, así que esta segunda FK es consistente.
-- ============================================================

alter table tenant_members
  add constraint tenant_members_user_id_profiles_fkey
  foreign key (user_id) references profiles(id) on delete cascade;
