-- ==============================================================================
-- MIGRACIÓN: OBSERVATORIO DE PRECIOS Y COSTOS DE INGENIERÍA
-- Vista analítica unificada de series de tiempo de insumos y variación de precios
-- Fecha: 2026-10-08
-- Idempotencia estricta: Zero-Downtime
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_item_price_history AS
-- Fuente 1: Costos Directos Estimados en Presupuestos APU (commercial_budgets)
SELECT 
    'presupuesto_apu'::text AS source_type,
    b.id AS source_id,
    b.budget_code AS source_code,
    b.client_name,
    b.project_title,
    COALESCE(b.project_title, 'Oficina Técnica / Planta')::text AS location,
    (it->>'description')::text AS description,
    COALESCE(
        it->>'normalized_key',
        LOWER(TRIM(REGEXP_REPLACE(it->>'description', '[^a-zA-Z0-9]', '', 'g')))
    )::text AS normalized_key,
    COALESCE(it->>'brand', 'Sin Marca')::text AS brand,
    COALESCE(it->>'suggested_supplier', 'Sin Proveedor')::text AS supplier,
    COALESCE(it->>'unit', 'Und')::text AS unit,
    COALESCE((it->>'quantity')::numeric, 1) AS quantity,
    COALESCE((it->>'unit_cost')::numeric, 0) AS unit_price,
    COALESCE((it->>'total_cost')::numeric, 0) AS total_amount,
    COALESCE(
        (it->>'recorded_at')::timestamptz,
        b.created_at
    ) AS recorded_at
FROM public.commercial_budgets b
CROSS JOIN LATERAL jsonb_array_elements(b.items_detail) it
WHERE it->>'description' IS NOT NULL

UNION ALL

-- Fuente 2: Precios Reales Solicitados en Requerimientos de Compra (purchase_requests)
SELECT 
    'requerimiento_compra'::text AS source_type,
    r.id AS source_id,
    r.request_code AS source_code,
    r.client_name,
    COALESCE(r.cost_center, 'Proyecto en Campo')::text AS project_title,
    COALESCE(r.delivery_site, 'Bodega / Obra')::text AS location,
    (it->>'description')::text AS description,
    COALESCE(
        it->>'normalized_key',
        LOWER(TRIM(REGEXP_REPLACE(it->>'description', '[^a-zA-Z0-9]', '', 'g')))
    )::text AS normalized_key,
    COALESCE(it->>'brand', 'Sin Marca')::text AS brand,
    COALESCE(it->>'suggested_supplier', 'Sin Proveedor')::text AS supplier,
    COALESCE(it->>'unit', 'Und')::text AS unit,
    COALESCE((it->>'quantity')::numeric, 1) AS quantity,
    COALESCE((it->>'unit_price')::numeric, 0) AS unit_price,
    COALESCE((it->>'total')::numeric, 0) AS total_amount,
    COALESCE(
        (it->>'recorded_at')::timestamptz,
        r.created_at
    ) AS recorded_at
FROM public.purchase_requests r
CROSS JOIN LATERAL jsonb_array_elements(r.items) it
WHERE it->>'description' IS NOT NULL;

COMMENT ON VIEW public.view_item_price_history IS 'Observatorio consolidado de precios históricos y trazabilidad de insumos de ingeniería en PROCIMEC';
