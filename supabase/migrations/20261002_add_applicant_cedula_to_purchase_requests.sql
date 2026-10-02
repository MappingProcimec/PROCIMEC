-- Migración: Añadir campo applicant_cedula a purchase_requests
-- Para trazabilidad y firma digital con cédula del solicitante

ALTER TABLE public.purchase_requests 
  ADD COLUMN IF NOT EXISTS applicant_cedula TEXT;
