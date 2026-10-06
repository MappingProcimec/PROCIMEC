-- ==============================================================================
-- Migración 025: Función RPC para cálculo instantáneo de métricas en PostgreSQL
-- ==============================================================================
-- Esta migración añade la función 'get_dashboard_metrics' para delegar el cálculo
-- agregado de horas CAD/BIM y metros lineales (ML) directamente al motor PostgreSQL.
-- Esto erradica la descarga masiva de filas y bucles 'while' en Serverless Functions,
-- reduciendo el consumo de Active CPU en Vercel a prácticamente cero milisegundos.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS TABLE (
  total_drawing_hours NUMERIC,
  total_ml NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(COALESCE(hours_worked, 0)) FROM public.drawing_activities), 0)::NUMERIC AS total_drawing_hours,
    COALESCE((
      SELECT SUM(
        CASE 
          WHEN (elem->>'ml') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (elem->>'ml')::NUMERIC 
          ELSE 0 
        END
      )
      FROM public.field_reports,
      LATERAL jsonb_array_elements(
        CASE 
          WHEN operational_summary IS NOT NULL AND jsonb_typeof(operational_summary::jsonb) = 'array' 
          THEN operational_summary::jsonb 
          ELSE '[]'::jsonb 
        END
      ) AS elem
    ), 0)::NUMERIC AS total_ml;
END;
$$;

-- Otorgar permisos de ejecución para roles autenticados y de servicio
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated, service_role;
