-- Migración: Ampliación de campos para Solicitud de Requerimiento (requerimiento-compra)
-- Consecutivo automatizado secuencial, datos de entrega, solicitante, aprobador e ítems estructurados

-- 1. Secuencia para el consecutivo numérico si no existe
CREATE SEQUENCE IF NOT EXISTS purchase_requests_consecutive_seq START WITH 1 INCREMENT BY 1;

-- 2. Añadir columnas a purchase_requests
ALTER TABLE public.purchase_requests 
  ADD COLUMN IF NOT EXISTS consecutive INT DEFAULT nextval('purchase_requests_consecutive_seq'),
  ADD COLUMN IF NOT EXISTS request_code TEXT,
  ADD COLUMN IF NOT EXISTS applicant_name TEXT,
  ADD COLUMN IF NOT EXISTS approver_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_site TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS cost_center TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14, 2) DEFAULT 0;

-- 3. Asignar valores por defecto a registros preexistentes si los hubiera
DO $$
BEGIN
  UPDATE public.purchase_requests
  SET consecutive = nextval('purchase_requests_consecutive_seq')
  WHERE consecutive IS NULL;

  UPDATE public.purchase_requests
  SET request_code = 'REQ-' || LPAD(consecutive::TEXT, 4, '0')
  WHERE request_code IS NULL;
END $$;
