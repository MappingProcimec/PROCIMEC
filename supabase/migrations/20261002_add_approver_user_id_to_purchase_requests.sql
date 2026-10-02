-- Migración: Agregar columna approver_user_id a purchase_requests (como UUID plano para evitar ambigüedad en relaciones PostgREST con users)
ALTER TABLE public.purchase_requests 
  ADD COLUMN IF NOT EXISTS approver_user_id UUID;

ALTER TABLE public.purchase_requests 
  DROP CONSTRAINT IF EXISTS purchase_requests_approver_user_id_fkey;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_approver_user_id 
  ON public.purchase_requests(approver_user_id);
