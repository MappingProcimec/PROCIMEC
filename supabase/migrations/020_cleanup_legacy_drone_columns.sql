-- ==============================================================================
-- Migration 020: Limpieza de Columnas y Tablas Obsoletas de Drone
-- Normaliza definitivamente public.hseq_inspections como tabla genérica multi-equipo
-- ==============================================================================

-- 1. Eliminar la vista/tabla obsoleta hseq_drone_inspections PRIMERO con CASCADE
DROP VIEW IF EXISTS public.hseq_drone_inspections CASCADE;
DROP TABLE IF EXISTS public.hseq_drone_inspections CASCADE;

-- 2. Asegurar columna equipment_name
ALTER TABLE IF EXISTS public.hseq_inspections
ADD COLUMN IF NOT EXISTS equipment_name TEXT;

-- 3. Migrar cualquier valor remanente antes de eliminar columnas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hseq_inspections' AND column_name = 'drone_brand_model'
  ) THEN
    UPDATE public.hseq_inspections
    SET equipment_brand_model = COALESCE(equipment_brand_model, drone_brand_model)
    WHERE equipment_brand_model IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hseq_inspections' AND column_name = 'drone_serial'
  ) THEN
    UPDATE public.hseq_inspections
    SET equipment_serial = COALESCE(equipment_serial, drone_serial)
    WHERE equipment_serial IS NULL;
  END IF;
END $$;

-- 4. Eliminar columnas obsoletas que contienen 'drone' con CASCADE
ALTER TABLE IF EXISTS public.hseq_inspections
DROP COLUMN IF EXISTS drone_brand_model CASCADE,
DROP COLUMN IF EXISTS drone_serial CASCADE;

-- 5. Normalizar divisiones canónicas en registros existentes
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
