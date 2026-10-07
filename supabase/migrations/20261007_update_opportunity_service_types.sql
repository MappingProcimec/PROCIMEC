-- ==============================================================================
-- MIGRACIÓN: Actualizar Restricción CHECK de Líneas de Servicio en commercial_opportunities
-- Permite: Obras Civiles en Planta, Montajes Mecánicos e Interventoría
-- ==============================================================================

ALTER TABLE public.commercial_opportunities 
DROP CONSTRAINT IF EXISTS commercial_opportunities_service_type_check;

ALTER TABLE public.commercial_opportunities 
ADD CONSTRAINT commercial_opportunities_service_type_check 
CHECK (service_type IN (
  'gpr_localizacion', 
  'civil_planta', 
  'montaje_mecanico', 
  'topografia_cad', 
  'inspeccion_dron', 
  'geofisica_integral', 
  'interventoria_obra', 
  'consultoria'
));
