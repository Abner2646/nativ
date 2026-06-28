-- Drop the overly permissive public update policy on reservations.
-- Cancellations flow through /api/reservations using supabaseAdmin (service role),
-- which bypasses RLS — no anonymous direct-update is needed.
DROP POLICY IF EXISTS "Public can update reservations" ON reservations;
