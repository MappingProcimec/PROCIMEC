-- ==============================================================================
-- CAPA 3 (HERRAMIENTAS TÉCNICAS DE GESTIÓN Y CONTROL)
-- Roles: Compras, Comercial, Finanzas, Contabilidad
-- Migración: 20261001_create_corporate_tools_capa3.sql
-- ==============================================================================

-- 1. Ampliar ENUM tool_category si aplica
DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'purchasing';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'commercial';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'finance';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'accounting';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Registrar las 4 Herramientas Técnicas en public.tools
INSERT INTO public.tools (slug, name, description, category, is_universal) VALUES
  (
    'purchasing-dashboard',
    'Gestión y Control de Compras',
    'Monitoreo centralizado de solicitudes de compra, órdenes de compra emitidas, control de entregas de insumos y calificación de proveedores.',
    'purchasing',
    false
  ),
  (
    'commercial-pipeline',
    'Pipeline y Gestión Comercial',
    'Seguimiento integral del embudo comercial, licitaciones activas, cotizaciones emitidas a clientes y control de cierres de negocio.',
    'commercial',
    false
  ),
  (
    'finance-expenses-board',
    'Control de Viáticos y Flujo de Fondos',
    'Administración y fiscalización de anticipos de viáticos, liquidación de gastos de campo y comprobantes de egreso.',
    'finance',
    false
  ),
  (
    'accounting-invoices-board',
    'Control de Facturación y Radicaciones',
    'Gestión de facturas de proveedores radicadas para pago y actas de corte de obra aprobadas para facturación al cliente.',
    'accounting',
    false
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_universal = EXCLUDED.is_universal;

-- 3. Vincular las herramientas a sus roles respectivos en public.role_tools

-- 3.1 Compras -> purchasing-dashboard
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE LOWER(r.name) IN ('compras', 'purchasing')
  AND t.slug = 'purchasing-dashboard'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_tools rt
    WHERE rt.role_id = r.id AND rt.tool_id = t.id
  );

-- 3.2 Comercial -> commercial-pipeline
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE LOWER(r.name) IN ('comercial', 'commercial')
  AND t.slug = 'commercial-pipeline'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_tools rt
    WHERE rt.role_id = r.id AND rt.tool_id = t.id
  );

-- 3.3 Finanzas -> finance-expenses-board
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE LOWER(r.name) IN ('finanzas', 'finance')
  AND t.slug = 'finance-expenses-board'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_tools rt
    WHERE rt.role_id = r.id AND rt.tool_id = t.id
  );

-- 3.4 Contabilidad -> accounting-invoices-board
INSERT INTO public.role_tools (role_id, tool_id)
SELECT r.id, t.id
FROM public.roles r
CROSS JOIN public.tools t
WHERE LOWER(r.name) IN ('contabilidad', 'accounting')
  AND t.slug = 'accounting-invoices-board'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_tools rt
    WHERE rt.role_id = r.id AND rt.tool_id = t.id
  );
