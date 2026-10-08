-- ==============================================================================
-- MIGRACIÓN: 20261008_create_suppliers_and_order_tracking.sql
-- Gestión de Compras PROCIMEC: Directorio de Proveedores y Órdenes de Compra
-- Plataforma PCM CLOUD — Mapping Ingeniería
-- Idempotencia estricta: Zero-Downtime
-- ==============================================================================

-- 1. TABLA DE PROVEEDORES INSTITUCIONALES (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  nit TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  category TEXT DEFAULT 'materiales',
  payment_terms TEXT DEFAULT 'Contado',
  bank_name TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON public.suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_nit ON public.suppliers(nit);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);

-- RLS para proveedores
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_read_all_auth" ON public.suppliers;
CREATE POLICY "suppliers_read_all_auth"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "suppliers_write_auth" ON public.suppliers;
CREATE POLICY "suppliers_write_auth"
  ON public.suppliers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. ENRIQUECER public.purchase_orders PARA ÍTEMS, SEGUIMIENTO Y PROVEEDOR
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'items_detail'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN items_detail JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'delivery_site'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN delivery_site TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'tracking_history'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN tracking_history JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Actualizar restricción de estados de purchase_orders para admitir el ciclo completo de entrega
DO $$
BEGIN
  ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
  ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check 
    CHECK (status IN ('issued', 'confirmed', 'in_transit', 'partially_received', 'completed', 'cancelled'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 3. PROVEEDORES BASE DE REFERENCIA
INSERT INTO public.suppliers (company_name, nit, contact_name, email, phone, city, category, payment_terms, notes)
VALUES
  ('Cantera Arenas', '900.123.456-1', 'Dpto. Despachos', 'ventas@canteraarenas.com', '3001234567', 'Barranquilla', 'Materiales Pétreos', 'Contado', 'Proveedor habitual de áridos y recebo'),
  ('Homecenter / Sodimac Colombia', '800.242.106-2', 'Ventas Corporativas', 'empresas@homecenter.co', '018000127373', 'Nacional', 'Ferretería y Herramientas', 'Contado', 'Compras menores y ferretería general'),
  ('Lahyer Colombia SAS', '900.567.890-3', 'Asesor Comercial', 'contacto@layher.com.co', '3157890123', 'Bogotá', 'Equipos y Andamios', 'Crédito 30 días', 'Andamiaje certificado multidireccional'),
  ('Ultracem SAS', '900.345.678-4', 'Despachos Planta', 'comercial@ultracem.co', '3104567890', 'Galapa / Barranquilla', 'Cementos y Concretos', 'Crédito 15 días', 'Concretos MR y cemento estructural'),
  ('Ferretería El Tornillo', '900.987.654-5', 'Atención Mostrador', 'eltornillo@gmail.com', '3019876543', 'Barranquilla', 'Ferretería y Tornillería', 'Contado', 'Ferretería liviana y consumibles')
ON CONFLICT (nit) DO UPDATE SET
  company_name = EXCLUDED.company_name;

-- 4. REGISTRAR FORMULARIO EN public.forms
INSERT INTO public.forms (slug, name, description, steps_count, has_attachments)
VALUES (
  'registro-proveedor',
  'Registro y Homologación de Proveedores',
  'Ficha técnica, datos tributarios, bancarios y comerciales de proveedores para compras.',
  2,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 5. VINCULAR A ROLES DE COMPRAS Y ADMINISTRACIÓN EN public.role_forms
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id FROM public.roles r CROSS JOIN public.forms f
WHERE (LOWER(r.name) IN ('compras', 'purchasing', 'admin', 'gerencia') OR r.name ILIKE '%compra%')
  AND f.slug = 'registro-proveedor'
ON CONFLICT DO NOTHING;

-- 6. REGISTRAR EN LISTADO MAESTRO DE CONTROL DE VERSIONES (LEY 8 - HSEQ / ISO 9001)
INSERT INTO public.document_format_versions (
  code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description
) VALUES (
  'FOR-COM-004',
  'Registro y Homologación de Proveedores',
  'Gestión de Compras y Suministros',
  'registro-proveedor',
  ARRAY['compras', 'admin', 'gerencia'],
  false,
  '1',
  CURRENT_DATE,
  'active',
  'compras',
  'Formato institucional para la captura de información tributaria, bancaria y comercial de nuevos proveedores homologados.'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  process = EXCLUDED.process,
  current_version = EXCLUDED.current_version;
