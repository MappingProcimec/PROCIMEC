-- ==============================================================================
-- Migración 023: Creación de la Tabla hr_letters y Registro de Herramienta/Formulario
-- Plataforma PROCIMEC — Módulo de Elaboración de Cartas RRHH
-- ==============================================================================

-- 1. Crear tabla principal para registro de cartas y certificaciones generadas
CREATE TABLE IF NOT EXISTS public.hr_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'audited', 'cancelled')),
  letter_type TEXT NOT NULL CHECK (
    letter_type IN (
      '01_certificacion_laboral',
      '02_presentacion_personal_obra',
      '03_vinculacion_a_proyecto',
      '04_terminacion_contrato',
      '05_paz_y_salvo',
      '06_permiso_laboral',
      '07_solicitud_entidad_externa'
    )
  ),
  letter_title TEXT NOT NULL,
  radicado TEXT NOT NULL,
  employee_name TEXT,
  employee_document TEXT,
  recipient_name TEXT,
  recipient_entity TEXT,
  letter_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_text TEXT NOT NULL,
  docx_url TEXT,
  pdf_url TEXT,
  docx_base64 TEXT,
  pdf_base64 TEXT,
  email_recipient TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ
);

-- 2. Índices de optimización O(1) para consultas y auditoría
CREATE INDEX IF NOT EXISTS idx_hr_letters_user_id ON public.hr_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_letters_project_id ON public.hr_letters(project_id);
CREATE INDEX IF NOT EXISTS idx_hr_letters_created_at ON public.hr_letters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_letters_letter_type ON public.hr_letters(letter_type);
CREATE INDEX IF NOT EXISTS idx_hr_letters_radicado ON public.hr_letters(radicado);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.hr_letters ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad RLS
CREATE POLICY "hr_letters_select_authenticated" ON public.hr_letters
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "hr_letters_insert_authenticated" ON public.hr_letters
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hr_letters_admin_all" ON public.hr_letters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- 5. Registrar Formulario en Catálogo (tabla forms)
INSERT INTO public.forms (slug, name, steps_count, has_attachments, description)
VALUES (
  'elaboracion-cartas',
  'Formulario de Elaboración de Cartas',
  2,
  false,
  'Generación estandarizada de cartas de RRHH y certificaciones corporativas con descarga inmediata en Word/PDF y notificación por correo.'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 6. Registrar Herramienta de Auditoría en Catálogo (tabla tools)
INSERT INTO public.tools (slug, name, category, is_universal, description)
VALUES (
  'cartas-audit',
  'Auditoría de Elaboración de Cartas',
  'rrhh',
  false,
  'Panel de fiscalización, auditoría y consulta de cartas y certificaciones generadas, con previsualización en texto, PDF y descarga DOCX.'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- 7. Asegurar clasificación canónica de herramientas operativas
UPDATE public.tools
SET category = 'universal', is_universal = true
WHERE slug = 'attendance-tracker';

UPDATE public.tools
SET category = 'rrhh', is_universal = false
WHERE slug = 'cartas-audit';

