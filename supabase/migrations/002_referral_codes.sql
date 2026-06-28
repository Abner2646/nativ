-- ============================================================
-- Migration 002: 6-digit referral codes on tenants
-- ============================================================

-- Function that generates a unique 6-digit numeric code
create or replace function generate_unique_referral_code()
returns text as $$
declare
  code text;
  attempts int := 0;
begin
  loop
    code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from tenants where referral_code = code);
    attempts := attempts + 1;
    if attempts > 100 then raise exception 'Could not generate unique referral code'; end if;
  end loop;
  return code;
end;
$$ language plpgsql;

-- Add column (nullable first so we can backfill)
alter table tenants add column if not exists referral_code text;

-- Backfill existing tenants
update tenants set referral_code = generate_unique_referral_code() where referral_code is null;

-- Make it required + unique
alter table tenants alter column referral_code set not null;
create unique index if not exists idx_tenants_referral_code on tenants(referral_code);

-- Trigger: auto-generate code on new tenant
create or replace function trg_set_referral_code()
returns trigger as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := generate_unique_referral_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_referral_code on tenants;
create trigger trg_auto_referral_code
  before insert on tenants
  for each row execute function trg_set_referral_code();

-- Drop old slug-based column from referrals (referral_code_used for audit trail)
alter table referrals add column if not exists referral_code_used text;
