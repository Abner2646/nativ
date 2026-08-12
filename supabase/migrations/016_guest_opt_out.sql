-- Apply via Supabase SQL Editor
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false;
