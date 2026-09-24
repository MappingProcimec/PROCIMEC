-- ==============================================================================
-- CAPA 2 (FORMULARIOS OPERACIONALES - INPUTS PUROS)
-- Roles: Compras, Comercial, Finanzas, Contabilidad
-- Migración: 20260924_create_corporate_roles_forms.sql
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. ROL COMPRAS (purchasing)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1.1 Requerimientos / Solicitudes de Compra (requerimiento-compra)
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('repuestos', 'insumos_campo', 'herramientas', 'servicios', 'epp', 'general')),
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta', 'urgente')),
  required_date DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_quotation', 'purchased')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 Órdenes de Compra y Adjudicación (orden-compra)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID REFERENCES public.purchase_requests(id),
  project_id UUID REFERENCES public.projects(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  order_code TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  supplier_nit TEXT,
  supplier_contact TEXT,
  total_amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  delivery_deadline DATE,
  payment_terms TEXT,
  attachment_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'partially_received', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 Evaluación y Recepción de Proveedores (evaluacion-proveedor)
CREATE TABLE IF NOT EXISTS public.supplier_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  supplier_name TEXT NOT NULL,
  quality_score INT NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
  delivery_time_score INT NOT NULL CHECK (delivery_time_score BETWEEN 1 AND 5),
  service_score INT NOT NULL CHECK (service_score BETWEEN 1 AND 5),
  overall_rating NUMERIC(3, 2),
  comments TEXT,
  recommend_supplier BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. ROL COMERCIAL (commercial)
-- ──────────────────────────────────────────────────────────────────────────────

-- 2.1 Registro de Oportunidad y Licitación (registro-oportunidad)
CREATE TABLE IF NOT EXISTS public.commercial_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  client_name TEXT NOT NULL,
  client_contact TEXT,
  client_email TEXT,
  client_phone TEXT,
  opportunity_title TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('gpr_localizacion', 'topografia_cad', 'inspeccion_dron', 'geofisica_integral', 'consultoria')),
  estimated_value NUMERIC(14, 2),
  deadline_date DATE,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'in_negotiation', 'won', 'lost', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Propuesta / Cotización Comercial (cotizacion-comercial)
CREATE TABLE IF NOT EXISTS public.commercial_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.commercial_opportunities(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  quote_code TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  scope_description TEXT NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  tax_amount NUMERIC(14, 2) DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL,
  validity_days INT DEFAULT 30,
  delivery_weeks INT DEFAULT 2,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Cierre de Negociación Comercial (cierre-comercial)
CREATE TABLE IF NOT EXISTS public.commercial_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.commercial_opportunities(id),
  proposal_id UUID REFERENCES public.commercial_proposals(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  result TEXT NOT NULL CHECK (result IN ('won', 'lost', 'cancelled')),
  final_contract_value NUMERIC(14, 2),
  contract_number TEXT,
  loss_reason TEXT,
  closing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. ROL FINANZAS (finance)
-- ──────────────────────────────────────────────────────────────────────────────

-- 3.1 Solicitud de Anticipos y Viáticos (solicitud-viaticos)
CREATE TABLE IF NOT EXISTS public.per_diem_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  beneficiary_name TEXT NOT NULL,
  beneficiary_document TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  estimated_transport NUMERIC(12, 2) DEFAULT 0,
  estimated_lodging NUMERIC(12, 2) DEFAULT 0,
  estimated_meals NUMERIC(12, 2) DEFAULT 0,
  estimated_tolls_fuel NUMERIC(12, 2) DEFAULT 0,
  estimated_total NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'disbursed', 'legalized', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Legalización y Rendición de Gastos (legalizacion-gastos)
CREATE TABLE IF NOT EXISTS public.expense_legalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  per_diem_request_id UUID REFERENCES public.per_diem_requests(id),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  advancement_amount NUMERIC(12, 2) NOT NULL,
  total_spent NUMERIC(12, 2) NOT NULL,
  balance NUMERIC(12, 2) NOT NULL,
  expense_receipts JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'adjusted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 Registro de Pagos y Comprobantes de Egreso (registro-pago)
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_concept TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_nit TEXT,
  amount NUMERIC(14, 2) NOT NULL,
  bank_source TEXT NOT NULL,
  transaction_reference TEXT NOT NULL,
  attachment_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. ROL CONTABILIDAD (accounting)
-- ──────────────────────────────────────────────────────────────────────────────

-- 4.1 Radicación de Facturas de Proveedores (radicacion-factura)
CREATE TABLE IF NOT EXISTS public.invoice_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_nit TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  tax_amount NUMERIC(14, 2) DEFAULT 0,
  withholding_tax NUMERIC(14, 2) DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL,
  concept TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'radicada' CHECK (status IN ('radicada', 'causada', 'pagada', 'anulada')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.2 Soporte de Cobro / Acta de Obra para Facturación (soporte-cobro)
CREATE TABLE IF NOT EXISTS public.billing_supports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  client_name TEXT NOT NULL,
  cut_period_start DATE NOT NULL,
  cut_period_end DATE NOT NULL,
  delivered_ml NUMERIC(10, 2),
  delivered_m2 NUMERIC(10, 2),
  amount_to_bill NUMERIC(14, 2) NOT NULL,
  acta_number TEXT,
  approver_client_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ready_to_invoice' CHECK (status IN ('ready_to_invoice', 'invoiced', 'collected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. HABILITAR RLS Y POLÍTICAS DE ACCESO
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'purchase_requests', 'purchase_orders', 'supplier_evaluations',
    'commercial_opportunities', 'commercial_proposals', 'commercial_closings',
    'per_diem_requests', 'expense_legalizations', 'payment_records',
    'invoice_filings', 'billing_supports'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Lectura autenticada en %s" ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "Lectura autenticada en %s" ON public.%I FOR SELECT TO authenticated USING (true);', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Modificacion autenticada en %s" ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "Modificacion autenticada en %s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl, tbl);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. REGISTRO EN CATÁLOGO public.forms
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO public.forms (slug, name, description, steps_count, has_attachments) VALUES
  ('requerimiento-compra', 'Requerimiento de Compra', 'Solicitud interna de insumos, herramientas o servicios requeridos por proyectos o áreas.', 2, false),
  ('orden-compra', 'Orden de Compra y Adjudicación', 'Registro formal de orden de compra, proveedor seleccionado, condiciones de pago y montos.', 2, true),
  ('evaluacion-proveedor', 'Evaluación de Proveedor', 'Calificación de calidad, tiempos de entrega y nivel de servicio de compras recibidas.', 2, false),
  ('registro-oportunidad', 'Registro de Oportunidad / Licitación', 'Captura de requerimientos de clientes, pliegos licitatorios y solicitudes comerciales.', 2, false),
  ('cotizacion-comercial', 'Cotización Comercial Emitida', 'Registro formal de propuesta económica y técnica presentada al cliente.', 2, true),
  ('cierre-comercial', 'Cierre de Negociación', 'Registro del desenlace comercial de la oferta: adjudicada, perdida o desierta.', 2, false),
  ('solicitud-viaticos', 'Solicitud de Viáticos y Anticipos', 'Petición formal de fondos para comisiones de campo, combustible, peajes y hospedajes.', 2, false),
  ('legalizacion-gastos', 'Legalización y Rendición de Gastos', 'Rendición pormenorizada de comprobantes de gastos ejecutados contra anticipos recibidos.', 2, true),
  ('registro-pago', 'Comprobante de Egreso y Pago', 'Captura de comprobante bancario, transferencias realizadas y soportes contables.', 2, true),
  ('radicacion-factura', 'Radicación de Factura Proveedor', 'Entrada y registro de facturas de proveedores para trámite de causación y pago.', 2, true),
  ('soporte-cobro', 'Soporte de Cobro y Facturación', 'Registro de corte de obra y actas de interventoría aprobadas para facturar al cliente.', 2, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  steps_count = EXCLUDED.steps_count,
  has_attachments = EXCLUDED.has_attachments;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. VINCULACIÓN DINÁMICA A ROLES EN public.role_forms
-- ──────────────────────────────────────────────────────────────────────────────

-- 7.1 Rol Compras
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id FROM public.roles r CROSS JOIN public.forms f
WHERE LOWER(r.name) IN ('compras', 'purchasing')
  AND f.slug IN ('requerimiento-compra', 'orden-compra', 'evaluacion-proveedor')
ON CONFLICT DO NOTHING;

-- 7.2 Rol Comercial
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id FROM public.roles r CROSS JOIN public.forms f
WHERE LOWER(r.name) IN ('comercial', 'commercial')
  AND f.slug IN ('registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial')
ON CONFLICT DO NOTHING;

-- 7.3 Rol Finanzas
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id FROM public.roles r CROSS JOIN public.forms f
WHERE LOWER(r.name) IN ('finanzas', 'finance')
  AND f.slug IN ('solicitud-viaticos', 'legalizacion-gastos', 'registro-pago')
ON CONFLICT DO NOTHING;

-- 7.4 Rol Contabilidad
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id FROM public.roles r CROSS JOIN public.forms f
WHERE LOWER(r.name) IN ('contabilidad', 'accounting')
  AND f.slug IN ('radicacion-factura', 'soporte-cobro')
ON CONFLICT DO NOTHING;
