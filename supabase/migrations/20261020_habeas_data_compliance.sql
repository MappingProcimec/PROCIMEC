-- ==============================================================================
-- Migración Idempotente: Habeas Data y Consentimiento Ley 1581 de 2012
-- PROCIMEC INGENIERÍA S.A.S. - PCM CLOUD
-- ==============================================================================

DO $$
BEGIN
  -- 1. Agregar columna para marca temporal de aceptación del consentimiento informado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'consent_accepted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN consent_accepted_at TIMESTAMPTZ;
  END IF;

  -- 2. Agregar columna para versión de la política aceptada (ej. '2026-v2')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'consent_version'
  ) THEN
    ALTER TABLE users ADD COLUMN consent_version TEXT DEFAULT '2026-v2';
  END IF;
END $$;
