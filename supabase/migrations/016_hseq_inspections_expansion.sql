-- ==============================================================================
-- MIGRACIÓN 016: EXPANSIÓN DE TABLA HSEQ INSPECTIONS (DIVISIÓN, EXCEL Y ALERTAS)
-- Arquitectura Guiada por Metadatos — Plataforma PROCIMEC
-- ==============================================================================

-- Añadir campos para división, plantilla Excel y control de anomalías
ALTER TABLE IF EXISTS hseq_drone_inspections
  ADD COLUMN IF NOT EXISTS division_name TEXT,
  ADD COLUMN IF NOT EXISTS format_code TEXT,
  ADD COLUMN IF NOT EXISTS format_title TEXT,
  ADD COLUMN IF NOT EXISTS excel_filename TEXT,
  ADD COLUMN IF NOT EXISTS excel_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS excel_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS has_anomalies BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS non_compliant_items JSONB DEFAULT '[]'::jsonb;

-- Comentario descriptivo
COMMENT ON COLUMN hseq_drone_inspections.division_name IS 'División empresarial asignada (Mapping, Ingeniería, etc.)';
COMMENT ON COLUMN hseq_drone_inspections.has_anomalies IS 'Indica si la inspección contiene respuestas NO o puntos críticos que alertan sobre el equipo';
