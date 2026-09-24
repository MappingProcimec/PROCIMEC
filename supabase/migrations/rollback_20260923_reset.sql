-- ==============================================================================
-- SCRIPT DE ROLLBACK / REVERSIÓN TOTAL (PROCIMEC)
-- Revierte todos los cambios creados por la migración 20260923_create_missing_role_tables.sql
-- Ejecutar en el SQL Editor de Supabase si se aplicó dicha migración.
-- ==============================================================================

-- 1. ELIMINAR TABLAS OPERATIVAS CREADAS (con sus políticas y triggers CASCADE)
DROP TABLE IF EXISTS public.equipment_checkouts CASCADE;
DROP TABLE IF EXISTS public.maintenance_logs CASCADE;
DROP TABLE IF EXISTS public.equipment CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;
DROP TABLE IF EXISTS public.opportunities CASCADE;
DROP TABLE IF EXISTS public.cash_flow_entries CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.advance_legalizations CASCADE;
DROP TABLE IF EXISTS public.certifications CASCADE;
DROP TABLE IF EXISTS public.training_records CASCADE;
DROP TABLE IF EXISTS public.employee_profiles CASCADE;
DROP TABLE IF EXISTS public.work_permits CASCADE;
DROP TABLE IF EXISTS public.safety_checklists CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;

-- 2. LIMPIAR ASIGNACIONES Y HERRAMIENTAS NUEVAS DEL CATÁLOGO
DELETE FROM public.role_tools WHERE tool_id IN (
  SELECT id FROM public.tools WHERE slug IN (
    'equipment-inventory', 'equipment-maintenance-board',
    'purchase-orders-board', 'suppliers-directory',
    'commercial-pipeline', 'quotes-history',
    'cash-flow-board', 'financial-scenarios',
    'invoice-tracking-board', 'gpr-metrics-extractor',
    'executive-dashboard', 'hseq-compliance-dashboard',
    'employee-directory', 'license-alerts-board'
  )
);

DELETE FROM public.tools WHERE slug IN (
  'equipment-inventory', 'equipment-maintenance-board',
  'purchase-orders-board', 'suppliers-directory',
  'commercial-pipeline', 'quotes-history',
  'cash-flow-board', 'financial-scenarios',
  'invoice-tracking-board', 'gpr-metrics-extractor',
  'executive-dashboard', 'hseq-compliance-dashboard',
  'employee-directory', 'license-alerts-board'
);

-- 3. LIMPIAR ASIGNACIONES Y FORMULARIOS NUEVOS DEL CATÁLOGO
DELETE FROM public.role_forms WHERE form_id IN (
  SELECT id FROM public.forms WHERE slug IN (
    'equipment-checkout', 'equipment-checkin', 'equipment-maintenance-record',
    'purchase-request-form', 'purchase-order-form', 'supplier-quote-form',
    'quote-creator-form', 'technical-visit-form',
    'annual-budget-form', 'budget-addition-form',
    'invoice-emission-form', 'advance-legalization-form',
    'executive-approval-form', 'work-permit-form',
    'daily-safety-checklist', 'incident-report-form',
    'training-record-form', 'deliverable-closing-form',
    'postprocessing-log-form'
  )
);

DELETE FROM public.forms WHERE slug IN (
  'equipment-checkout', 'equipment-checkin', 'equipment-maintenance-record',
  'purchase-request-form', 'purchase-order-form', 'supplier-quote-form',
  'quote-creator-form', 'technical-visit-form',
  'annual-budget-form', 'budget-addition-form',
  'invoice-emission-form', 'advance-legalization-form',
  'executive-approval-form', 'work-permit-form',
  'daily-safety-checklist', 'incident-report-form',
  'training-record-form', 'deliverable-closing-form',
  'postprocessing-log-form'
);

-- 4. ELIMINAR LOS ROLES NUEVOS DE LA TABLA ROLES
DELETE FROM public.role_tools WHERE role_id IN (
  SELECT id FROM public.roles WHERE name IN ('warehouse', 'purchasing', 'commercial', 'finance', 'accounting', 'management')
);
DELETE FROM public.role_forms WHERE role_id IN (
  SELECT id FROM public.roles WHERE name IN ('warehouse', 'purchasing', 'commercial', 'finance', 'accounting', 'management')
);
DELETE FROM public.roles WHERE name IN ('warehouse', 'purchasing', 'commercial', 'finance', 'accounting', 'management');

-- 5. RESTAURAR ROLES ORIGINALES EN USUARIOS Y EL CHECK CONSTRAINT PREVIO
UPDATE public.users SET role = 'dibujo' WHERE role = 'drawing';
UPDATE public.users SET role = 'localizador' WHERE role = 'operator';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'localizador', 'operator', 'pending', 'dibujo'));
