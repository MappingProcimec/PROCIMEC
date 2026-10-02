-- Verificación de Centro de Costos en la tabla projects
-- En Supabase la columna oficial es cost_center

ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS cost_center TEXT;
