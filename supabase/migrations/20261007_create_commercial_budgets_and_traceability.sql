-- ==============================================================================
-- MIGRACIÓN: PRESUPUESTOS OPERATIVOS APU Y TRAZABILIDAD COMERCIAL ARTICULADA
-- Código de Calidad: FOR-CMR-004 y enlaces bidireccionales con proyectos
-- Fecha: 2026-10-07
-- Idempotencia estricta: Zero-Downtime
-- ==============================================================================

-- 1. Crear tabla de Presupuestos Operativos y APU de Ingeniería (FOR-CMR-004)
CREATE TABLE IF NOT EXISTS public.commercial_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consecutive_number INT NOT NULL DEFAULT 1,
    budget_code TEXT NOT NULL UNIQUE,
    opportunity_id UUID REFERENCES public.commercial_opportunities(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES public.users(id),
    created_by_name TEXT NOT NULL DEFAULT '',
    created_by_email TEXT NOT NULL DEFAULT '',
    client_name TEXT NOT NULL,
    project_title TEXT NOT NULL,
    service_category TEXT NOT NULL DEFAULT 'mapping_geofisica',
    direct_cost_materials NUMERIC(14, 2) NOT NULL DEFAULT 0,
    direct_cost_equipment NUMERIC(14, 2) NOT NULL DEFAULT 0,
    direct_cost_labor NUMERIC(14, 2) NOT NULL DEFAULT 0,
    direct_cost_logistics NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_direct_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    aiu_percentage NUMERIC(5, 2) NOT NULL DEFAULT 25.00,
    suggested_sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    items_detail JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'quoted', 'archived')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_commercial_budgets_code ON public.commercial_budgets(budget_code);
CREATE INDEX IF NOT EXISTS idx_commercial_budgets_client ON public.commercial_budgets(client_name);
CREATE INDEX IF NOT EXISTS idx_commercial_budgets_opp ON public.commercial_budgets(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_commercial_budgets_status ON public.commercial_budgets(status);

-- 2. Enriquecer Oportunidades con Consecutivos y Auditoría de Autor
ALTER TABLE public.commercial_opportunities
    ADD COLUMN IF NOT EXISTS consecutive_number INT,
    ADD COLUMN IF NOT EXISTS opportunity_code TEXT,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_commercial_opps_code ON public.commercial_opportunities(opportunity_code);

-- 3. Enriquecer Cotizaciones con Presupuesto, Consecutivos y Vinculación Bidireccional a Proyectos
ALTER TABLE public.commercial_proposals
    ADD COLUMN IF NOT EXISTS consecutive_number INT,
    ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES public.commercial_budgets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_commercial_proposals_budget ON public.commercial_proposals(budget_id);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_project ON public.commercial_proposals(project_id);

-- 4. Enriquecer Cierres Comerciales con Consecutivos y Presupuesto
ALTER TABLE public.commercial_closings
    ADD COLUMN IF NOT EXISTS consecutive_number INT,
    ADD COLUMN IF NOT EXISTS closing_code TEXT,
    ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES public.commercial_budgets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT,
    ADD COLUMN IF NOT EXISTS created_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_commercial_closings_code ON public.commercial_closings(closing_code);

-- 5. Enriquecer Proyectos con Enlaces a Cotización, Cierre y Presupuesto
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS commercial_proposal_id UUID REFERENCES public.commercial_proposals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS commercial_closing_id UUID REFERENCES public.commercial_closings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS commercial_budget_id UUID REFERENCES public.commercial_budgets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_comm_proposal ON public.projects(commercial_proposal_id);
CREATE INDEX IF NOT EXISTS idx_projects_comm_closing ON public.projects(commercial_closing_id);
CREATE INDEX IF NOT EXISTS idx_projects_comm_budget ON public.projects(commercial_budget_id);

-- 6. Habilitar RLS en commercial_budgets
ALTER TABLE public.commercial_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_budgets_read_auth" ON public.commercial_budgets;
CREATE POLICY "commercial_budgets_read_auth"
    ON public.commercial_budgets
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "commercial_budgets_write_auth" ON public.commercial_budgets;
CREATE POLICY "commercial_budgets_write_auth"
    ON public.commercial_budgets
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 7. Registrar formulario de Presupuesto en public.forms
INSERT INTO public.forms (slug, name, description, steps_count, has_attachments)
VALUES (
    'presupuesto-proyecto',
    'Presupuesto Operativo y APU de Ingeniería',
    'Estructura de costos directos (materiales, equipos, mano de obra, logística) y cálculo de AIU y margen comercial.',
    2,
    false
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    steps_count = EXCLUDED.steps_count,
    has_attachments = EXCLUDED.has_attachments;

-- 8. Asignar formulario a roles pertinentes (Comercial, Dibujo, Gerencia, Admin)
DO $$
DECLARE
    v_form_id UUID;
    v_role RECORD;
BEGIN
    SELECT id INTO v_form_id FROM public.forms WHERE slug = 'presupuesto-proyecto' LIMIT 1;
    IF v_form_id IS NOT NULL THEN
        FOR v_role IN
            SELECT id FROM public.roles
            WHERE LOWER(name) IN ('comercial', 'commercial', 'dibujo', 'drawing', 'gerencia', 'management', 'admin', 'administrador')
        LOOP
            INSERT INTO public.role_forms (role_id, form_id)
            VALUES (v_role.id, v_form_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- 9. Registrar formato FOR-CMR-004 en el listado maestro de versiones si la tabla existe
DO $$
DECLARE
    v_doc_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_format_versions') THEN
        INSERT INTO public.document_format_versions (
            code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description
        ) VALUES (
            'FOR-CMR-004',
            'Presupuesto Operativo y APU de Ingeniería',
            'Gestión Comercial',
            'presupuesto-proyecto',
            ARRAY['Comercial', 'Dibujo', 'Gerencia', 'Admin'],
            false,
            '1',
            '2026-10-07',
            'active',
            'commercial',
            'Estructura técnica de costos directos APU para proyectos de geofísica, topografía y obras civiles de planta.'
        )
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            current_version = EXCLUDED.current_version,
            effective_date = EXCLUDED.effective_date;

        SELECT id INTO v_doc_id FROM public.document_format_versions WHERE code = 'FOR-CMR-004' LIMIT 1;
        IF v_doc_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'format_version_history') THEN
            INSERT INTO public.format_version_history (
                format_id, version, change_date, change_reason, responsible_name, file_format
            ) VALUES (
                v_doc_id,
                '1',
                '2026-10-07',
                'Emisión oficial de formato APU para geofísica, topografía y obras civiles in-house.',
                'Dirección Técnica y Comercial',
                'xlsx'
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
