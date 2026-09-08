-- Migración 008: Metas y configuración de alcance de proyectos
-- Permite definir metros lineales / área objetivo y si el proyecto requiere mapeo y/o geolocalización

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS target_ml NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_m2 NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_metric_type TEXT DEFAULT 'ml',
  ADD COLUMN IF NOT EXISTS requires_mapping BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_positioning BOOLEAN DEFAULT true;
