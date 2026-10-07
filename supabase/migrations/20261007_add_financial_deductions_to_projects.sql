-- ==============================================================================
-- MIGRACIÓN: GESTIÓN FINANCIERA, DEDUCCIONES Y VALOR DE EJECUCIÓN DE PROYECTOS
-- FORMATO: Idempotente (Zero-Downtime, Ley 2)
-- RAZÓN SOCIAL: PROCIMEC INGENIERÍA S.A.S.
-- ==============================================================================

-- 1. Agregar columnas financieras y de deducciones a la tabla projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions_percentage NUMERIC(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_value NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions_config JSONB DEFAULT '[]'::jsonb;

-- 2. Comentarios de auditoría y documentación técnica en el catálogo de PostgreSQL
COMMENT ON COLUMN public.projects.contract_value IS 'Valor total contractual o del proyecto en COP antes de deducciones';
COMMENT ON COLUMN public.projects.deductions_percentage IS 'Suma consolidada de porcentajes de deducciones activas (%)';
COMMENT ON COLUMN public.projects.deductions_amount IS 'Monto total deducido del valor contractual en COP';
COMMENT ON COLUMN public.projects.execution_value IS 'Presupuesto neto disponible para la ejecución directa del proyecto tras deducciones';
COMMENT ON COLUMN public.projects.deductions_config IS 'Desglose JSONB de las deducciones configuradas (IVA, ReteFuente, ReteICA, AI, etc.)';

-- 3. Función y Trigger para mantener la consistencia de cómputo en la BD
CREATE OR REPLACE FUNCTION public.fn_sync_project_execution_value()
RETURNS TRIGGER AS $$
BEGIN
  NEW.contract_value := COALESCE(NEW.contract_value, 0);
  NEW.deductions_percentage := COALESCE(NEW.deductions_percentage, 0);
  
  -- Recalcular deductions_amount y execution_value garantizando cero discrepancias matemáticas
  NEW.deductions_amount := ROUND((NEW.contract_value * (NEW.deductions_percentage / 100.0)), 2);
  NEW.execution_value := GREATEST(0, ROUND(NEW.contract_value - NEW.deductions_amount, 2));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_project_execution_value ON public.projects;
CREATE TRIGGER trg_sync_project_execution_value
BEFORE INSERT OR UPDATE OF contract_value, deductions_percentage
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_project_execution_value();
