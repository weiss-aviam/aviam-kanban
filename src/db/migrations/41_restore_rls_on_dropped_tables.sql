-- 41_restore_rls_on_dropped_tables.sql
--
-- Re-enable Row Level Security on tables whose RLS configuration was lost
-- during the serial-to-UUID conversion in migration 06, and on internal
-- bookkeeping tables that were never explicitly secured.
--
-- All policies for the 6 board/template tables already exist (created in
-- migrations 04 and 05); enabling RLS activates them. _drizzle_migrations
-- has no policies and gets default-deny, which is the correct posture for
-- an internal metadata table the application never reads via PostgREST.
--
-- Also flips invitation_status_view to security_invoker mode so it enforces
-- the caller's RLS instead of the view owner's privileges.

-- ---------------------------------------------------------------------------
-- Board content (policies created in 05_*, table object replaced in 06_*)
-- ---------------------------------------------------------------------------
ALTER TABLE cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_labels  ENABLE ROW LEVEL SECURITY;

-- FORCE so even the table owner is subject to RLS; admin client uses
-- service_role which bypasses RLS by design, so this does not break it.
ALTER TABLE cards        FORCE ROW LEVEL SECURITY;
ALTER TABLE comments     FORCE ROW LEVEL SECURITY;
ALTER TABLE labels       FORCE ROW LEVEL SECURITY;
ALTER TABLE card_labels  FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Template content (table object replaced in 06_*)
-- ---------------------------------------------------------------------------
ALTER TABLE column_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_columns  ENABLE ROW LEVEL SECURITY;

ALTER TABLE column_templates  FORCE ROW LEVEL SECURITY;
ALTER TABLE template_columns  FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Drizzle internal metadata: default-deny (no policies needed)
-- ---------------------------------------------------------------------------
ALTER TABLE _drizzle_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE _drizzle_migrations FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- View: enforce caller's RLS, not the view owner's
-- ---------------------------------------------------------------------------
ALTER VIEW invitation_status_view SET (security_invoker = true);
