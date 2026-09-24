-- ==============================================================================
-- CAPA 2 (FORMULARIOS): Formulario de Registro y Alta de Instrumental (registro-equipo)
-- Tabla de soporte: public.equipment
-- Registro en catálogo: public.forms y public.role_forms
-- ==============================================================================

-- 1. Crear tabla de equipos e instrumental técnico
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'gpr',              -- Georradar GPR
    'antenna',          -- Antena GPR
    'gnss',             -- Receptor GNSS / RTK
    'total_station',    -- Estación Total / Topografía
    'radiodetection',   -- Localizador electromagnético
    'vehicle',          -- Vehículo / Dron
    'accessory',        -- Batería / Cable / Odómetro / Maletín
    'other'             -- Otro instrumental
  )),
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
    'available',        -- Disponible en bodega
    'in_field',         -- Despachado a frente de obra
    'maintenance',      -- En mantenimiento preventivo/correctivo
    'calibration',      -- En laboratorio de calibración
    'decommissioned'    -- De baja
  )),
  calibration_date DATE,
  calibration_expiry_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_code ON public.equipment(code);

-- Habilitar RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Políticas RLS:
-- Lectura permitida a usuarios autenticados
DROP POLICY IF EXISTS "Lectura de equipos permitida a autenticados" ON public.equipment;
CREATE POLICY "Lectura de equipos permitida a autenticados"
  ON public.equipment FOR SELECT
  TO authenticated
  USING (true);

-- Inserción y actualización permitida a Admin y Almacén
DROP POLICY IF EXISTS "Gestion de equipos por admin y warehouse" ON public.equipment;
CREATE POLICY "Gestion de equipos por admin y warehouse"
  ON public.equipment FOR ALL
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
  'registro-equipo',
  'Registro y Alta de Instrumental',
  'Alta e ingreso de georradares, antenas, receptores RTK y accesorios al inventario corporativo de PROCIMEC.',
  2,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.forms WHERE slug = 'registro-equipo'
);

-- 3. Vincular el formulario al rol Almacén en public.role_forms
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id
FROM public.roles r
CROSS JOIN public.forms f
WHERE LOWER(r.name) IN ('almacén', 'almacen', 'warehouse')
  AND f.slug = 'registro-equipo'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_forms rf
    WHERE rf.role_id = r.id AND rf.form_id = f.id
  );
