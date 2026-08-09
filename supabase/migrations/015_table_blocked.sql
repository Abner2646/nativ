-- 015: add is_blocked to restaurant_tables for per-table service blocking
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
