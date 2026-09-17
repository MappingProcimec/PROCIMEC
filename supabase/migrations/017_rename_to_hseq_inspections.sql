-- ==============================================================================
-- MIGRACIÓN 017: RENOMBRADO CANÓNICO A HSEQ_INSPECTIONS Y EXPANSIÓN TOTAL
-- Arquitectura Guiada por Metadatos — Plataforma PROCIMEC
-- ==============================================================================

-- 1. Renombrar tabla si existe con el nombre anterior hseq_drone_inspections
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hseq_drone_inspections')
     AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hseq_inspections') THEN
    ALTER TABLE public.hseq_drone_inspections RENAME TO hseq_inspections;
  END IF;
END $$;

-- 2. Si la tabla no existía bajo ningún nombre, crearla de forma canónica
CREATE TABLE IF NOT EXISTS public.hseq_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'draft')),
  
  -- Encabezado de Operación
  cost_center TEXT,
  location TEXT,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  equipment_brand_model TEXT DEFAULT 'Equipo Estándar',
  equipment_serial TEXT,
  drone_brand_model TEXT DEFAULT 'DJI Mavic 3 Enterprise',
  drone_serial TEXT,
  
  -- Respuestas de ítems de verificación (JSONB normalizado)
  items_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Cierre y Observaciones
  critical_point TEXT DEFAULT 'Ninguno',
  general_observations TEXT,
  
  -- Firmas Digitales Oficiales (Nombre Verificado y Trazo Base64)
  operator_name TEXT NOT NULL,
  operator_signature_data TEXT NOT NULL,
  ssta_name TEXT NOT NULL,
  ssta_signature_data TEXT NOT NULL,
  
  -- División y Formato
  division_name TEXT,
  format_code TEXT,
  format_title TEXT,
  
  -- Archivos de Evidencias (Supabase Storage y Google Drive)
  drive_file_id TEXT,
  drive_web_view_link TEXT,
  pdf_filename TEXT,
  pdf_storage_path TEXT,
  pdf_url TEXT,
  excel_filename TEXT,
  excel_storage_path TEXT,
  excel_url TEXT,
  
  -- Control de Anomalías
  has_anomalies BOOLEAN DEFAULT false,
  non_compliant_items JSONB DEFAULT '[]'::jsonb
);

-- 3. Asegurar la existencia de todas las columnas (incluso si la tabla ya existía de migraciones 015/016)
ALTER TABLE public.hseq_inspections
  ADD COLUMN IF NOT EXISTS equipment_brand_model TEXT,
  ADD COLUMN IF NOT EXISTS equipment_serial TEXT,
  ADD COLUMN IF NOT EXISTS drone_brand_model TEXT DEFAULT 'DJI Mavic 3 Enterprise',
  ADD COLUMN IF NOT EXISTS drone_serial TEXT,
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

-- 4. Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_project_id ON public.hseq_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_user_id ON public.hseq_inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_date ON public.hseq_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_created_at ON public.hseq_inspections(created_at DESC);

-- 5. Vista de retrocompatibilidad para lecturas anteriores
CREATE OR REPLACE VIEW public.hseq_drone_inspections AS
  SELECT * FROM public.hseq_inspections;

COMMENT ON TABLE public.hseq_inspections IS 'Registro canónico de inspecciones pre-operacionales HSEQ (Drones, Estación Total, Georadar, etc.)';
