-- ==============================================================================
-- CAPA 2 & 3: Unificación Operativa de Almacén y Herramienta Kárdex de Bodega
-- Migración: 20260924_warehouse_unification_and_inventory_tool.sql
-- ==============================================================================

-- 1. Ampliar tabla de despachos con campos de reingreso / retorno de campo
ALTER TABLE public.equipment_checkouts
  ADD COLUMN IF NOT EXISTS return_notes TEXT,
  ADD COLUMN IF NOT EXISTS return_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS return_user_id UUID REFERENCES public.users(id);

-- 2. Crear tabla de consumibles de terreno (pintura, estacas, cintas, baterías, etc.)
CREATE TABLE IF NOT EXISTS public.consumables_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'terreno',
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidades',
  supplier TEXT,
  invoice_number TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consumibles
CREATE INDEX IF NOT EXISTS idx_consumables_date ON public.consumables_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_consumables_user ON public.consumables_entries(user_id);

-- Habilitar RLS en consumibles
ALTER TABLE public.consumables_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de consumibles para autenticados" ON public.consumables_entries;
CREATE POLICY "Lectura de consumibles para autenticados"
  ON public.consumables_entries FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Gestion de consumibles por admin y warehouse" ON public.consumables_entries;
CREATE POLICY "Gestion de consumibles por admin y warehouse"
  ON public.consumables_entries FOR ALL
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

-- 3. Extender ENUM tool_category si aplica
DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'warehouse';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Registrar Herramienta Técnica (Capa 3): Kárdex e Inventario Activo de Bodega
INSERT INTO public.tools (slug, name, description, category, is_universal)
VALUES (
  'warehouse-inventory',
  'Kárdex e Inventario Activo de Bodega',
  'Gestión en tiempo real del stock de instrumental, trazabilidad de equipos en campo, control de calibraciones y kárdex histórico de movimientos.',
  'warehouse',
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- 5. Vincular Herramienta al Rol Almacén
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE LOWER(r.name) IN ('almacén', 'almacen', 'warehouse')
  AND t.slug = 'warehouse-inventory'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_tools rt
    WHERE rt.role_id = r.id AND rt.tool_id = t.id
  );

-- 6. Actualizar catálogo del formulario de registro y movimientos de almacén
UPDATE public.forms
SET 
  name = 'Movimientos y Control de Almacén',
  description = 'Captura operativa de bodega: despachos a obra, retornos con checklist, alta de instrumental e ingreso de consumibles de terreno.',
  steps_count = 2
WHERE slug = 'registro-equipo';

-- 7. Asegurar vinculación del formulario al rol Almacén
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
