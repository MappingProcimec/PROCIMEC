-- ==============================================================================
-- Migración 018: Normalización Canónica de HSEQ Inspections
-- 1. Eliminar definitivamente la vista obsoleta hseq_drone_inspections
-- 2. Asegurar columnas canónicas en hseq_inspections (sin prefijo drone)
-- 3. Migrar datos residuales y normalizar nombres de división canónicos
-- ==============================================================================

-- 1. Eliminar la vista/tabla obsoleta hseq_drone_inspections
DROP VIEW IF EXISTS public.hseq_drone_inspections CASCADE;
DROP TABLE IF EXISTS public.hseq_drone_inspections CASCADE;

-- 2. Asegurar que hseq_inspections exista con todas las columnas canónicas
CREATE TABLE IF NOT EXISTS public.hseq_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'audited')),
  cost_center TEXT,
  location TEXT,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  equipment_brand_model TEXT,
  equipment_serial TEXT,
  items_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  critical_point TEXT,
  general_observations TEXT,
  operator_name TEXT NOT NULL,
  operator_signature_data TEXT,
  ssta_name TEXT NOT NULL,
  ssta_signature_data TEXT,
  drive_file_id TEXT,
  drive_web_view_link TEXT,
  pdf_filename TEXT,
  pdf_storage_path TEXT,
  pdf_url TEXT,
  excel_filename TEXT,
  excel_storage_path TEXT,
  excel_url TEXT,
  format_code TEXT DEFAULT 'FOR-HSEQ-024',
  format_title TEXT DEFAULT 'INSPECCIÓN PRE-OPERACIONAL DE DRONE',
  division_name TEXT DEFAULT 'Mapping',
  has_anomalies BOOLEAN DEFAULT false,
  non_compliant_items JSONB DEFAULT '[]'::jsonb
);

-- 3. Asegurar que las columnas canónicas existan si la tabla ya existía
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS equipment_brand_model TEXT;
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS equipment_serial TEXT;
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS format_code TEXT DEFAULT 'FOR-HSEQ-024';
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS format_title TEXT DEFAULT 'INSPECCIÓN PRE-OPERACIONAL DE DRONE';
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS division_name TEXT DEFAULT 'Mapping';
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS has_anomalies BOOLEAN DEFAULT false;
ALTER TABLE public.hseq_inspections ADD COLUMN IF NOT EXISTS non_compliant_items JSONB DEFAULT '[]'::jsonb;

-- 4. Migrar datos de columnas legacy si existen en la tabla
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hseq_inspections' AND column_name = 'drone_brand_model'
  ) THEN
    UPDATE public.hseq_inspections 
    SET equipment_brand_model = COALESCE(equipment_brand_model, drone_brand_model)
    WHERE equipment_brand_model IS NULL AND drone_brand_model IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hseq_inspections' AND column_name = 'drone_serial'
  ) THEN
    UPDATE public.hseq_inspections 
    SET equipment_serial = COALESCE(equipment_serial, drone_serial)
    WHERE equipment_serial IS NULL AND drone_serial IS NOT NULL;
  END IF;
END $$;

-- 5. Normalizar nombres de división a los estructurados de la empresa ('Mapping' o 'Ingeniería')
UPDATE public.hseq_inspections
SET division_name = 'Ingeniería'
WHERE division_name ILIKE '%ingenier%' OR division_name ILIKE '%topo%';

UPDATE public.hseq_inspections
SET division_name = 'Mapping'
WHERE division_name IS NULL OR division_name ILIKE '%map%' OR division_name ILIKE '%dron%';

-- 6. Índices para rendimiento O(1)
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_project ON public.hseq_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_user ON public.hseq_inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_date ON public.hseq_inspections(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_format ON public.hseq_inspections(format_code);
CREATE INDEX IF NOT EXISTS idx_hseq_inspections_division ON public.hseq_inspections(division_name);
