-- ==============================================================================
-- Migración 014: Registrar categoría HSEQ, herramientas y formularios HSEQ
-- y asegurar la nomenclatura oficial del rol 'Localizador'.
-- ==============================================================================

-- 1. Extender ENUM tool_category con valor 'hseq'
DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'hseq';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Registrar herramientas HSEQ en la tabla tools
INSERT INTO tools (slug, name, description, category, is_universal) VALUES
  (
    'hseq-formats',
    'Gestión y Llenado HSEQ con IA',
    'Asistente inteligente para la configuración de plantillas HSEQ (rol HSEQ) y llenado ágil guiado por voz/formulario (rol Localizador) con exportación directa a PDF.',
    'hseq',
    false
  ),
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

-- 3. Registrar formulario de inspección HSEQ en la tabla forms
INSERT INTO forms (slug, name, description, steps_count, has_attachments) VALUES
  (
    'hseq-report',
    'Formulario de Inspección HSEQ (con IA)',
    'Formulario de campo HSEQ para Localizadores con soporte de dictado por voz y generación directa de PDF en Google Drive.',
    2,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
