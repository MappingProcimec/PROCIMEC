-- Migration 019: Add equipment_name to hseq_inspections and normalize existing records
ALTER TABLE IF EXISTS public.hseq_inspections
ADD COLUMN IF NOT EXISTS equipment_name TEXT;

-- Normalize divisions according to canonical format domain
UPDATE public.hseq_inspections
SET 
  division_name = 'Mapping',
  equipment_name = COALESCE(equipment_name, 'Drone')
WHERE 
  format_code = 'FOR-HSEQ-024' 
  OR LOWER(COALESCE(format_title, '')) LIKE '%drone%';

UPDATE public.hseq_inspections
SET 
  division_name = 'Ingeniería',
  equipment_name = COALESCE(equipment_name, 'Estación Total')
WHERE 
  format_code = 'FOR-HSEQ-025' 
  OR LOWER(COALESCE(format_title, '')) LIKE '%estaci%';
