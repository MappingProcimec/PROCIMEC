-- Estandarización de Centro de Costos en la tabla projects
-- Añadir formalmente la columna cost_center y sincronizarla con el code existente

ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS cost_center TEXT;

-- Sincronizar los registros existentes
UPDATE public.projects 
SET cost_center = code 
WHERE cost_center IS NULL OR cost_center = '';

-- Trigger opcional para mantener cost_center y code siempre sincronizados
CREATE OR REPLACE FUNCTION public.sync_project_cost_center()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cost_center IS NULL OR NEW.cost_center = '' THEN
    NEW.cost_center := NEW.code;
  END IF;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := NEW.cost_center;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_project_cost_center ON public.projects;
CREATE TRIGGER trg_sync_project_cost_center
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_cost_center();
