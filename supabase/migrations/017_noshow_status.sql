-- Add no-show as a valid reservation status
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'no-show';
