-- ==============================================================================
-- MIGRACIÓN: 20261022_enforce_canonical_form_categories.sql
-- DESCRIPCIÓN: Gobernanza y blindaje estricto de categorías de formularios.
--              Erradica definitivamente 'general' y fuerza las 9 áreas oficiales:
--              gpr, cad, hseq, warehouse, purchasing, commercial, finance, accounting, rrhh.
-- LEYES: Cumplimiento estricto de LEY 2 (Integridad PostgreSQL) y LEY 8 (SIG/HSEQ)
-- ==============================================================================

-- 1. Asegurar columna category en tabla forms
ALTER TABLE public.forms
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'hseq';

-- 2. Normalizar y categorizar todos los formularios existentes
UPDATE public.forms
SET category = 'hseq'
WHERE slug IN ('hseq-report', 'hseq', 'analisis-planificacion-cambios-sig', 'cambios-sig', 'gestion-cambio')
   OR slug LIKE '%sig%'
   OR slug LIKE '%hseq%';

UPDATE public.forms
SET category = 'gpr'
WHERE slug IN ('gpr-field-form', 'gpr-report')
   OR slug LIKE '%gpr%'
   OR slug LIKE '%radar%';

UPDATE public.forms
SET category = 'cad'
WHERE slug IN ('cad-register-form', 'cad-register', 'nueva-actividad')
   OR slug LIKE '%cad%'
   OR slug LIKE '%bim%';

UPDATE public.forms
SET category = 'warehouse'
WHERE slug IN ('registro-equipo', 'despacho-equipo', 'retorno-equipo', 'alta-equipo', 'equipo-nuevo')
   OR slug LIKE '%equipo%'
   OR slug LIKE '%almacen%';

UPDATE public.forms
SET category = 'purchasing'
WHERE slug IN ('requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor')
   OR slug LIKE '%compra%'
   OR slug LIKE '%proveedor%';

UPDATE public.forms
SET category = 'commercial'
WHERE slug IN ('registro-oportunidad', 'presupuesto-proyecto', 'cotizacion-comercial', 'cierre-comercial')
   OR slug LIKE '%comercial%'
   OR slug LIKE '%cotizacion%'
   OR slug LIKE '%presupuesto%';

UPDATE public.forms
SET category = 'finance'
WHERE slug IN ('solicitud-viaticos', 'legalizacion-gastos', 'registro-pago')
   OR slug LIKE '%viatico%'
   OR slug LIKE '%gasto%'
   OR slug LIKE '%pago%';

UPDATE public.forms
SET category = 'accounting'
WHERE slug IN ('radicacion-factura', 'soporte-cobro')
   OR slug LIKE '%factura%'
   OR slug LIKE '%cobro%';

UPDATE public.forms
SET category = 'rrhh'
WHERE slug IN ('elaboracion-cartas', 'cartas', 'cartas-rrhh')
   OR slug LIKE '%carta%'
   OR slug LIKE '%rrhh%';

-- Cualquier formulario restante no mapeado se normaliza obligatoriamente a 'hseq' (nunca 'general')
UPDATE public.forms
SET category = 'hseq'
WHERE category IS NULL 
   OR category NOT IN ('gpr', 'cad', 'hseq', 'warehouse', 'purchasing', 'commercial', 'finance', 'accounting', 'rrhh');

-- 3. Crear restricción CHECK dura en el motor de base de datos
ALTER TABLE public.forms
    DROP CONSTRAINT IF EXISTS chk_forms_canonical_category;

ALTER TABLE public.forms
    ADD CONSTRAINT chk_forms_canonical_category
    CHECK (category IN ('gpr', 'cad', 'hseq', 'warehouse', 'purchasing', 'commercial', 'finance', 'accounting', 'rrhh'));

-- 4. Trigger de base de datos para auto-asignar categoría canónica a futuros formularios
CREATE OR REPLACE FUNCTION public.fn_enforce_canonical_form_category()
RETURNS TRIGGER AS $$
DECLARE
    v_combined TEXT;
BEGIN
    v_combined := LOWER(COALESCE(NEW.slug, '') || ' ' || COALESCE(NEW.name, ''));

    -- Si la categoría viene vacía o inválida, el motor asigna automáticamente la agrupación predeterminada
    IF NEW.category IS NULL OR NEW.category NOT IN ('gpr', 'cad', 'hseq', 'warehouse', 'purchasing', 'commercial', 'finance', 'accounting', 'rrhh') THEN
        IF v_combined ~* '(sig|hseq|cambio|inspeccion|seguridad|sst|calidad|riesgo)' THEN
            NEW.category := 'hseq';
        ELSIF v_combined ~* '(gpr|radar|geofis|localiz)' THEN
            NEW.category := 'gpr';
        ELSIF v_combined ~* '(cad|bim|dwg|rvt|dibujo|modelo)' THEN
            NEW.category := 'cad';
        ELSIF v_combined ~* '(equipo|almacen|bodega|stock|inventario|despacho|retorno)' THEN
            NEW.category := 'warehouse';
        ELSIF v_combined ~* '(compra|proveedor|insumo|requerimiento|orden)' THEN
            NEW.category := 'purchasing';
        ELSIF v_combined ~* '(comercial|oportunidad|licitacion|cotizacion|cierre|cliente|presupuesto|apu)' THEN
            NEW.category := 'commercial';
        ELSIF v_combined ~* '(viatico|gasto|pago|tesoreria|egreso|anticipo)' THEN
            NEW.category := 'finance';
        ELSIF v_combined ~* '(factura|cobro|contab|acta|radicacion)' THEN
            NEW.category := 'accounting';
        ELSIF v_combined ~* '(carta|rrhh|laboral|talento|empleado)' THEN
            NEW.category := 'rrhh';
        ELSE
            -- Salvaguarda: todo formato institucional pertenece al Sistema Integrado de Gestión (HSEQ & SIG)
            NEW.category := 'hseq';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_canonical_form_category ON public.forms;
CREATE TRIGGER trg_enforce_canonical_form_category
    BEFORE INSERT OR UPDATE ON public.forms
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_canonical_form_category();

-- 5. Crear índice para acelerar filtrado por categoría en consultas de administración
CREATE INDEX IF NOT EXISTS idx_forms_category ON public.forms(category);
