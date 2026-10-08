-- ==============================================================================
-- MIGRACIÓN: 20261008_create_clients_and_tool_registration.sql
-- Plataforma PCM CLOUD — Mapping Ingeniería
-- Gestión Comercial (Clientes) y Gestión de Compras (Proveedores)
-- Idempotencia estricta: Zero-Downtime (Ley 2)
-- ==============================================================================

-- 1. TABLA MAESTRA DE CLIENTES INSTITUCIONALES (clients)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  nit TEXT UNIQUE,
  contact_name TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  client_type TEXT DEFAULT 'corporativo' CHECK (client_type IN ('corporativo', 'publico', 'contratista', 'particular')),
  economic_sector TEXT DEFAULT 'Infraestructura',
  payment_terms TEXT DEFAULT 'Contado',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'prospect', 'inactive', 'blocked')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de búsqueda ágil
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_nit ON public.clients(nit);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_sector ON public.clients(economic_sector);

-- RLS para clientes
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_read_all_auth" ON public.clients;
CREATE POLICY "clients_read_all_auth"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "clients_write_auth" ON public.clients;
CREATE POLICY "clients_write_auth"
  ON public.clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. POBLAR CLIENTES INICIALES DESDE OPORTUNIDADES Y PROYECTOS EXISTENTES
DO $$
BEGIN
  -- Insertar desde commercial_opportunities si no existen
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commercial_opportunities') THEN
    INSERT INTO public.clients (company_name, contact_name, email, phone, status, notes)
    SELECT DISTINCT ON (TRIM(LOWER(co.client_name)))
      TRIM(co.client_name),
      co.client_contact,
      co.client_email,
      co.client_phone,
      'active',
      'Cliente migrado automáticamente desde Oportunidades Comerciales.'
    FROM public.commercial_opportunities co
    WHERE co.client_name IS NOT NULL AND TRIM(co.client_name) <> ''
    ON CONFLICT (company_name) DO NOTHING;
  END IF;

  -- Insertar desde projects si no existen
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    INSERT INTO public.clients (company_name, status, notes)
    SELECT DISTINCT ON (TRIM(LOWER(p.client)))
      TRIM(p.client),
      'active',
      'Cliente migrado automáticamente desde Proyectos Operativos.'
    FROM public.projects p
    WHERE p.client IS NOT NULL AND TRIM(p.client) <> ''
    ON CONFLICT (company_name) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Clientes base de referencia si la tabla quedó vacía
INSERT INTO public.clients (company_name, nit, contact_name, contact_role, email, phone, city, economic_sector, payment_terms, status)
VALUES
  ('Consorcio Vías del Norte', '901.456.789-1', 'Ing. Carlos Mendoza', 'Director de Obra', 'cmendoza@viasdelnorte.com', '3104567890', 'Barranquilla', 'Infraestructura Vial', 'Crédito 30 días', 'active'),
  ('Constructora Bolívar S.A.', '860.052.123-4', 'Arq. Marcela Gómez', 'Gerente de Proyectos', 'mgomez@constructora-bolivar.co', '3157891234', 'Bogotá', 'Edificación y Vivienda', 'Crédito 45 días', 'active'),
  ('Ecopetrol S.A.', '899.999.068-1', 'Ing. Fernando Ruiz', 'Líder Geofísica & Subsuelo', 'fruiz@ecopetrol.com.co', '3001234567', 'Nacional', 'Petróleo y Gas', 'Crédito 60 días', 'active'),
  ('Triple A S.A. E.S.P.', '800.123.456-7', 'Ing. Roberto Silva', 'Jefe Redes Acueducto', 'rsilva@aaa.com.co', '3019876543', 'Barranquilla', 'Servicios Públicos', 'Crédito 30 días', 'active'),
  ('Argos Concretos S.A.S.', '890.900.266-3', 'Dra. Patricia Peña', 'Compras y Contratación', 'ppena@argos.com.co', '3187654321', 'Medellín', 'Materiales y Concretos', 'Contado', 'active')
ON CONFLICT (company_name) DO NOTHING;

-- 3. REGISTRAR LAS 2 NUEVAS HERRAMIENTAS EN public.tools (CAPA 3)
INSERT INTO public.tools (slug, name, description, category, is_universal)
VALUES
  (
    'commercial-clients',
    'Directorio y Gestión de Clientes',
    'Directorio corporativo, seguimiento de cuentas, sectores económicos, condiciones comerciales y ficha técnica de clientes.',
    'commercial',
    false
  ),
  (
    'purchasing-suppliers',
    'Directorio y Gestión de Proveedores',
    'Directorio maestro, homologación técnica, condiciones comerciales, cuentas bancarias e historial de órdenes de proveedores.',
    'purchasing',
    false
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_universal = EXCLUDED.is_universal;

-- 4. VINCULAR HERRAMIENTA COMERCIAL A ROLES CORRESPONDIENTES (role_tools)
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE (LOWER(r.name) IN ('comercial', 'commercial', 'admin', 'gerencia') OR r.name ILIKE '%comercial%')
  AND t.slug = 'commercial-clients'
ON CONFLICT DO NOTHING;

-- 5. VINCULAR HERRAMIENTA COMPRAS A ROLES CORRESPONDIENTES (role_tools)
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE (LOWER(r.name) IN ('compras', 'purchasing', 'admin', 'gerencia') OR r.name ILIKE '%compra%')
  AND t.slug = 'purchasing-suppliers'
ON CONFLICT DO NOTHING;
