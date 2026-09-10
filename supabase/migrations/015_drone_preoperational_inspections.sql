-- ==============================================================================
-- MIGRACIÓN 015: TABLA DE INSPECCIÓN PRE-OPERACIONAL DE DRONE (HSEQ)
-- Arquitectura Guiada por Metadatos — Plataforma PROCIMEC
-- ==============================================================================

CREATE TABLE IF NOT EXISTS hseq_drone_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'draft')),
  
  -- Encabezado de Operación
  cost_center TEXT,
  location TEXT,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  drone_brand_model TEXT NOT NULL DEFAULT 'DJI Mavic 3 Enterprise',
  drone_serial TEXT,
  
  -- Respuestas de los 25 ítems (clave: '1.1', valor: 'SI' | 'NO' | 'NA')
  items_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Cierre y Observaciones
  critical_point TEXT DEFAULT 'Ninguno',
  general_observations TEXT,
  
  -- Firmas Digitales con Nombre Verificado y Trazo Canvas en Pantalla
  operator_name TEXT NOT NULL,
  operator_signature_data TEXT NOT NULL,
  ssta_name TEXT NOT NULL,
  ssta_signature_data TEXT NOT NULL,
  
  -- Archivo de Evidencia PDF (Google Drive / Almacenamiento)
  drive_file_id TEXT,
  drive_web_view_link TEXT,
  pdf_filename TEXT
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_drone_inspections_project_id ON hseq_drone_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_drone_inspections_user_id ON hseq_drone_inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_drone_inspections_date ON hseq_drone_inspections(inspection_date);
