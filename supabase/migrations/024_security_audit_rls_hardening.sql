-- ==============================================================================
-- Migración 024: Blindaje de Seguridad Integral y Corrección de RLS
-- Plataforma PROCIMEC / PCM CLOUD
--
-- 1. Habilitar RLS en tablas expuestas (hseq_inspections, user_division_roles, division_projects)
-- 2. Eliminar políticas permisivas USING (true) en tablas financieras, comerciales, compras y contabilidad
-- 3. Blindar asignación de permisos (user_tools, user_forms) para que solo admin pueda modificarlos
-- 4. Blindar tabla de cartas de recursos humanos (hr_letters) contra lectura pública de nómina/salarios
-- 5. Configurar políticas con principio de mínimo privilegio por rol y autoría
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. TABLA: hseq_inspections (Inspecciones de campo HSEQ y Dron)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.hseq_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hseq_inspections_select" ON public.hseq_inspections;
DROP POLICY IF EXISTS "hseq_inspections_insert" ON public.hseq_inspections;
DROP POLICY IF EXISTS "hseq_inspections_update" ON public.hseq_inspections;
DROP POLICY IF EXISTS "hseq_inspections_delete" ON public.hseq_inspections;

-- Lectura: inspector creador, roles HSEQ y Admin
CREATE POLICY "hseq_inspections_select" ON public.hseq_inspections
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hseq', 'management')
    )
  );

-- Inserción: inspectores autenticados que firman su propio registro
CREATE POLICY "hseq_inspections_insert" ON public.hseq_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hseq')
    )
  );

-- Actualización: creador o roles supervisores HSEQ/Admin
CREATE POLICY "hseq_inspections_update" ON public.hseq_inspections
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hseq')
    )
  );

-- Eliminación: reservada exclusivamente a Admin
CREATE POLICY "hseq_inspections_delete" ON public.hseq_inspections
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. TABLAS ESTRUCTURALES: user_division_roles y division_projects
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.user_division_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.division_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_division_roles_read" ON public.user_division_roles;
DROP POLICY IF EXISTS "user_division_roles_admin" ON public.user_division_roles;
CREATE POLICY "user_division_roles_read" ON public.user_division_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_division_roles_admin" ON public.user_division_roles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "division_projects_read" ON public.division_projects;
DROP POLICY IF EXISTS "division_projects_admin" ON public.division_projects;
CREATE POLICY "division_projects_read" ON public.division_projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "division_projects_admin" ON public.division_projects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. ASIGNACIÓN DE HERRAMIENTAS Y FORMULARIOS: user_tools y user_forms
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_tools_admin_all" ON public.user_tools;
DROP POLICY IF EXISTS "user_tools_read_authenticated" ON public.user_tools;
CREATE POLICY "user_tools_read_authenticated" ON public.user_tools
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "user_tools_admin_all" ON public.user_tools
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "user_forms_admin_all" ON public.user_forms;
DROP POLICY IF EXISTS "user_forms_read_authenticated" ON public.user_forms;
CREATE POLICY "user_forms_read_authenticated" ON public.user_forms
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY "user_forms_admin_all" ON public.user_forms
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. TABLA: hr_letters (Cartas Laborales, Salarios y Novedades de Nómina)
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hr_letters_select_authenticated" ON public.hr_letters;
DROP POLICY IF EXISTS "hr_letters_insert_authenticated" ON public.hr_letters;
DROP POLICY IF EXISTS "hr_letters_admin_all" ON public.hr_letters;

-- Lectura: el usuario que generó la carta, o roles RRHH/Admin/Gerencia
CREATE POLICY "hr_letters_select_restricted" ON public.hr_letters
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'rrhh', 'hr', 'management')
    )
  );

-- Inserción: únicamente RRHH o Admin
CREATE POLICY "hr_letters_insert_restricted" ON public.hr_letters
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'rrhh', 'hr')
    )
  );

-- Modificación y eliminación: solo Admin
CREATE POLICY "hr_letters_admin_all" ON public.hr_letters
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. BLINDAJE DE TABLAS CORPORATIVAS (COMPRAS, COMERCIAL, FINANZAS, CONTABILIDAD)
-- ──────────────────────────────────────────────────────────────────────────────

-- 5.1 COMPRAS (purchase_requests, purchase_orders, supplier_evaluations)
DROP POLICY IF EXISTS "Lectura autenticada en purchase_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Modificacion autenticada en purchase_requests" ON public.purchase_requests;
CREATE POLICY "purchase_requests_access" ON public.purchase_requests
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'purchasing', 'warehouse', 'management', 'finance')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'purchasing')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Modificacion autenticada en purchase_orders" ON public.purchase_orders;
CREATE POLICY "purchase_orders_access" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'purchasing', 'management', 'finance', 'accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'purchasing')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en supplier_evaluations" ON public.supplier_evaluations;
DROP POLICY IF EXISTS "Modificacion autenticada en supplier_evaluations" ON public.supplier_evaluations;
CREATE POLICY "supplier_evaluations_access" ON public.supplier_evaluations
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'purchasing', 'management')
    )
  );

-- 5.2 COMERCIAL (commercial_opportunities, commercial_proposals, commercial_closings)
DROP POLICY IF EXISTS "Lectura autenticada en commercial_opportunities" ON public.commercial_opportunities;
DROP POLICY IF EXISTS "Modificacion autenticada en commercial_opportunities" ON public.commercial_opportunities;
CREATE POLICY "commercial_opportunities_access" ON public.commercial_opportunities
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'commercial', 'management')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en commercial_proposals" ON public.commercial_proposals;
DROP POLICY IF EXISTS "Modificacion autenticada en commercial_proposals" ON public.commercial_proposals;
CREATE POLICY "commercial_proposals_access" ON public.commercial_proposals
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'commercial', 'management')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en commercial_closings" ON public.commercial_closings;
DROP POLICY IF EXISTS "Modificacion autenticada en commercial_closings" ON public.commercial_closings;
CREATE POLICY "commercial_closings_access" ON public.commercial_closings
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'commercial', 'management')
    )
  );

-- 5.3 FINANZAS (per_diem_requests, expense_legalizations, payment_records)
DROP POLICY IF EXISTS "Lectura autenticada en per_diem_requests" ON public.per_diem_requests;
DROP POLICY IF EXISTS "Modificacion autenticada en per_diem_requests" ON public.per_diem_requests;
CREATE POLICY "per_diem_requests_access" ON public.per_diem_requests
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'finance', 'management', 'accounting')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en expense_legalizations" ON public.expense_legalizations;
DROP POLICY IF EXISTS "Modificacion autenticada en expense_legalizations" ON public.expense_legalizations;
CREATE POLICY "expense_legalizations_access" ON public.expense_legalizations
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'finance', 'management', 'accounting')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en payment_records" ON public.payment_records;
DROP POLICY IF EXISTS "Modificacion autenticada en payment_records" ON public.payment_records;
CREATE POLICY "payment_records_access" ON public.payment_records
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'finance', 'management', 'accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'finance')
    )
  );

-- 5.4 CONTABILIDAD (invoice_filings, billing_supports)
DROP POLICY IF EXISTS "Lectura autenticada en invoice_filings" ON public.invoice_filings;
DROP POLICY IF EXISTS "Modificacion autenticada en invoice_filings" ON public.invoice_filings;
CREATE POLICY "invoice_filings_access" ON public.invoice_filings
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'accounting', 'finance', 'management')
    )
  );

DROP POLICY IF EXISTS "Lectura autenticada en billing_supports" ON public.billing_supports;
DROP POLICY IF EXISTS "Modificacion autenticada en billing_supports" ON public.billing_supports;
CREATE POLICY "billing_supports_access" ON public.billing_supports
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'accounting', 'finance', 'management')
    )
  );
