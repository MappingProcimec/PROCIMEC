-- ==============================================================================
-- CAPA 2 (FORMULARIOS): Formulario de Despacho y Salida a Campo (despacho-equipo)
-- Tabla de soporte: public.equipment_checkouts
-- Registro en catálogo: public.forms y public.role_forms
-- ==============================================================================

-- 1. Crear tabla de despachos y salidas a campo
CREATE TABLE IF NOT EXISTS public.equipment_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  user_id UUID NOT NULL REFERENCES public.users(id),              -- Usuario de almacén que autoriza y despacha
  responsible_user_id UUID REFERENCES public.users(id),          -- Usuario que recibe el equipo en campo
  responsible_name TEXT,                                         -- Nombre respaldo del receptor
  checkout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  actual_return_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',       -- En campo actualmente
    'returned',     -- Devuelto a bodega
    'overdue'       -- Retrasado respecto a la fecha estimada
  )),
  checklist JSONB DEFAULT '{}'::jsonb,                           -- Accesorios verificados (baterías, cables, odómetro, etc.)
  notes TEXT,                                                    -- Observaciones físicas de salida
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_eq_checkouts_project ON public.equipment_checkouts(project_id);
CREATE INDEX IF NOT EXISTS idx_eq_checkouts_equipment ON public.equipment_checkouts(equipment_id);
CREATE INDEX IF NOT EXISTS idx_eq_checkouts_status ON public.equipment_checkouts(status);
CREATE INDEX IF NOT EXISTS idx_eq_checkouts_date ON public.equipment_checkouts(checkout_date);

-- Habilitar RLS
ALTER TABLE public.equipment_checkouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS:
-- Lectura permitida a usuarios autenticados
DROP POLICY IF EXISTS "Lectura de despachos permitida a autenticados" ON public.equipment_checkouts;
CREATE POLICY "Lectura de despachos permitida a autenticados"
  ON public.equipment_checkouts FOR SELECT
  TO authenticated
  USING (true);

-- Inserción y actualización permitida a Admin y Almacén
DROP POLICY IF EXISTS "Gestion de despachos por admin y warehouse" ON public.equipment_checkouts;
CREATE POLICY "Gestion de despachos por admin y warehouse"
  ON public.equipment_checkouts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'warehouse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'warehouse')
    )
  );

-- 2. Registrar el formulario en el catálogo public.forms
INSERT INTO public.forms (slug, name, description, steps_count, has_attachments)
SELECT 
  'despacho-equipo',
  'Despacho y Salida a Campo',
  'Registro formal de salida de instrumental geofísico hacia frentes de obra con checklist de accesorios y responsable.',
  2,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.forms WHERE slug = 'despacho-equipo'
);

-- 3. Vincular el formulario al rol Almacén en public.role_forms
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id
FROM public.roles r
CROSS JOIN public.forms f
WHERE LOWER(r.name) IN ('almacén', 'almacen', 'warehouse')
  AND f.slug = 'despacho-equipo'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_forms rf
    WHERE rf.role_id = r.id AND rf.form_id = f.id
  );
