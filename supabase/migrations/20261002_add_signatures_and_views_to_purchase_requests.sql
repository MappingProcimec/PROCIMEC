-- Migración: Ampliar purchase_requests para control de 4 firmas digitales y auditoría de lecturas (viewed_by)
-- Soporte para ciclo: Solicitante (1), Director de Proyecto (2), Compras (3) y Gerencia (4)

ALTER TABLE public.purchase_requests 
  ADD COLUMN IF NOT EXISTS signatures JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS viewed_by JSONB DEFAULT '[]'::jsonb;

-- Actualizar la restricción de estados para admitir el ciclo completo sin fricciones
ALTER TABLE public.purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_status_check;
ALTER TABLE public.purchase_requests 
  ADD CONSTRAINT purchase_requests_status_check 
  CHECK (status IN ('pending', 'in_quotation', 'quoted', 'approved', 'purchased', 'rejected'));
