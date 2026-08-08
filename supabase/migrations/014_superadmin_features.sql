-- 014_superadmin_features.sql

-- Audit log for superadmin actions
CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text        NOT NULL,
  action      text        NOT NULL,
  target_type text,
  target_id   text,
  target_name text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE superadmin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins can read audit log"
  ON superadmin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_superadmin = true
    )
  );

-- Internal notes and feature flags per tenant (superadmin-only fields)
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS feature_flags  jsonb NOT NULL DEFAULT '{}';
