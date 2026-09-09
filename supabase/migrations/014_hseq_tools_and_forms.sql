-- ==============================================================================
-- Migración 014: Registrar categoría HSEQ, Tablero de Evidencias y Formulario HSEQ.
-- Nota: En Supabase SQL Editor, si el enum aún no tiene 'hseq', ejecutar primero:
-- ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'hseq';
-- ==============================================================================

-- 1. Extender ENUM tool_category con valor 'hseq'
DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'hseq';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Limpiar herramienta redundante si existiera
DELETE FROM tools WHERE slug = 'hseq-formats';

-- 3. Registrar herramienta: Tablero de Evidencias HSEQ
INSERT INTO tools (slug, name, description, category, is_universal) VALUES
  (
    'evidence-board',
    'Tablero de Evidencias HSEQ',
    'Consolidado centralizado de evidencias en PDF almacenadas en Google Drive, con filtros avanzados por localizador, proyecto y fecha.',
    'hseq',
    false
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- 4. Registrar formulario: Formulario de Inspección HSEQ
INSERT INTO forms (slug, name, description, steps_count, has_attachments) VALUES
  (
    'hseq-report',
    'Formulario de Inspección HSEQ',
    'Formulario de campo HSEQ para Localizadores con soporte de dictado por voz y generación directa de PDF en Google Drive.',
    2,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
