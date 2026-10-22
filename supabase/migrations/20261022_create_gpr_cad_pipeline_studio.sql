-- ==============================================================================
-- MIGRACIÓN: 20261022_create_gpr_cad_pipeline_studio.sql
-- DESCRIPCIÓN: Tablas para el Estudio de Procesamiento GPR & CAD/BIM AI (Capa 3)
--              Orquestación en 5 pasos, cuantificación de costos APU y entregables.
-- LEYES: Cumplimiento de LEY 2 (Integridad PostgreSQL) y LEY 4 (Hub Centralizado)
-- ==============================================================================

-- 1. Tabla de Trabajos / Pipelines de Procesamiento por Proyecto
CREATE TABLE IF NOT EXISTS public.gpr_pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL DEFAULT 'Pipeline de Procesamiento GPR & CAD/BIM',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'failed')),
    current_step TEXT DEFAULT 'cad_2d',
    
    -- Métricas de entrada del levantamiento (provenientes de field_reports)
    input_metrics JSONB NOT NULL DEFAULT '{
        "total_ml": 0,
        "total_m2": 0,
        "utilities_count": 0,
        "reports_count": 0,
        "tramos_count": 0,
        "max_depth_m": 0
    }'::jsonb,

    -- Tarifas APU configuradas para el cálculo de costos (en COP)
    cost_rates JSONB NOT NULL DEFAULT '{
        "cad_2d_rate_per_ml": 2500,
        "gpr_proc_rate_per_ml": 3000,
        "cad_refine_rate_per_utility": 35000,
        "bim_3d_rate_per_ml": 4500,
        "report_fixed_rate": 350000
    }'::jsonb,

    -- Desglose cuantificado de costos (en COP)
    cost_breakdown JSONB NOT NULL DEFAULT '{
        "cad_2d_cost": 0,
        "gpr_proc_cost": 0,
        "cad_refine_cost": 0,
        "bim_3d_cost": 0,
        "report_cost": 0
    }'::jsonb,

    total_cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_gpr_pipeline_jobs_project ON public.gpr_pipeline_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_gpr_pipeline_jobs_created_by ON public.gpr_pipeline_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_gpr_pipeline_jobs_status ON public.gpr_pipeline_jobs(status);

-- 2. Tabla de Pasos Secuenciales del Pipeline (5 Pasos Canónicos)
CREATE TABLE IF NOT EXISTS public.gpr_pipeline_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.gpr_pipeline_jobs(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL CHECK (step_order BETWEEN 1 AND 5),
    step_key TEXT NOT NULL CHECK (step_key IN ('cad_2d', 'gpr_raw_proc', 'cad_2d_refine', 'bim_3d_rvt', 'project_report')),
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    
    -- Cuantificación financiera de este paso específico
    cost_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- Archivos de entrada, plantilla y salida
    template_file_url TEXT,
    template_file_name TEXT,
    output_file_url TEXT,
    output_file_name TEXT,
    output_file_type TEXT, -- 'dwg', 'dxf', 'rvt', 'ifc', 'docx', 'pdf'
    
    -- Inteligencia Artificial (Prompt generado e inferencia)
    ai_prompt TEXT,
    ai_response TEXT,
    ai_model_used TEXT DEFAULT 'Claude-3.5-Sonnet',
    token_usage JSONB DEFAULT '{"input_tokens": 0, "output_tokens": 0}'::jsonb,
    
    -- Auditoría de ejecución
    execution_logs TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gpr_pipeline_steps_job ON public.gpr_pipeline_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_gpr_pipeline_steps_order ON public.gpr_pipeline_steps(job_id, step_order);

-- 3. Trigger para inicializar automáticamente los 5 pasos al crear un trabajo
CREATE OR REPLACE FUNCTION public.fn_initialize_gpr_pipeline_steps()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Elaboración del Plano 2D
    INSERT INTO public.gpr_pipeline_steps (
        job_id, step_order, step_key, step_name, status, output_file_type
    ) VALUES (
        NEW.id, 1, 'cad_2d', '1. Elaboración del Plano 2D (.dwg / .dxf)', 'pending', 'dwg'
    );

    -- 2. Procesamiento de Datos Crudos GPR
    INSERT INTO public.gpr_pipeline_steps (
        job_id, step_order, step_key, step_name, status, output_file_type
    ) VALUES (
        NEW.id, 2, 'gpr_raw_proc', '2. Procesamiento de Datos Crudos GPR (Filtros y Radargramas)', 'pending', 'pdf'
    );

    -- 3. Mejora y Ajuste del Plano 2D
    INSERT INTO public.gpr_pipeline_steps (
        job_id, step_order, step_key, step_name, status, output_file_type
    ) VALUES (
        NEW.id, 3, 'cad_2d_refine', '3. Mejora y Calibración de Interferencias en Plano 2D', 'pending', 'dwg'
    );

    -- 4. Elaboración del Modelo 3D
    INSERT INTO public.gpr_pipeline_steps (
        job_id, step_order, step_key, step_name, status, output_file_type
    ) VALUES (
        NEW.id, 4, 'bim_3d_rvt', '4. Elaboración del Modelo 3D BIM (.rvt / IFC)', 'pending', 'rvt'
    );

    -- 5. Informe Final del Proyecto
    INSERT INTO public.gpr_pipeline_steps (
        job_id, step_order, step_key, step_name, status, output_file_type
    ) VALUES (
        NEW.id, 5, 'project_report', '5. Informe Final del Proyecto y Resumen Ejecutivo', 'pending', 'docx'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_initialize_gpr_pipeline_steps ON public.gpr_pipeline_jobs;
CREATE TRIGGER trg_initialize_gpr_pipeline_steps
    AFTER INSERT ON public.gpr_pipeline_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_initialize_gpr_pipeline_steps();

-- 4. Habilitar RLS en ambas tablas
ALTER TABLE public.gpr_pipeline_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gpr_pipeline_steps ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para gpr_pipeline_jobs
CREATE POLICY "Permitir lectura a usuarios autenticados con acceso al proyecto"
    ON public.gpr_pipeline_jobs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'administrador', 'gerencia', 'management', 'dibujo', 'drawing', 'localizador', 'operator')
                OR EXISTS (
                    SELECT 1 FROM public.user_projects up
                    WHERE up.user_id = auth.uid() AND up.project_id = gpr_pipeline_jobs.project_id
                )
              )
        )
    );

CREATE POLICY "Permitir inserción y actualización a roles autorizados"
    ON public.gpr_pipeline_jobs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.role IN ('admin', 'administrador', 'gerencia', 'management', 'dibujo', 'drawing', 'localizador', 'operator')
        )
    );

-- Políticas de RLS para gpr_pipeline_steps
CREATE POLICY "Permitir lectura de pasos del pipeline"
    ON public.gpr_pipeline_steps
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.gpr_pipeline_jobs j
            WHERE j.id = gpr_pipeline_steps.job_id
        )
    );

CREATE POLICY "Permitir actualización de pasos a roles autorizados"
    ON public.gpr_pipeline_steps
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.role IN ('admin', 'administrador', 'gerencia', 'management', 'dibujo', 'drawing', 'localizador', 'operator')
        )
    );

-- 5. Registrar la Herramienta Oficial en public.tools (Capa 3 de Navegación)
INSERT INTO public.tools (slug, name, description, category, is_universal)
VALUES (
    'gpr-cad-studio',
    'Estudio de Procesamiento GPR & CAD/BIM AI',
    'Orquestador inteligente para procesamiento de datos crudos GPR, planos 2D DWG, modelos 3D RVT e informes finales con cuantificación de costos APU.',
    'gpr',
    false
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_universal = EXCLUDED.is_universal;

-- 6. Vincular la herramienta a roles operativos y de dibujo
DO $$
DECLARE
    v_tool_id UUID;
    v_role_record RECORD;
BEGIN
    SELECT id INTO v_tool_id FROM public.tools WHERE slug = 'gpr-cad-studio' LIMIT 1;

    IF v_tool_id IS NOT NULL THEN
        FOR v_role_record IN
            SELECT id FROM public.roles
            WHERE LOWER(name) IN ('admin', 'administrador', 'gerencia', 'management', 'dibujo', 'drawing', 'localizador', 'operator')
        LOOP
            INSERT INTO public.role_tools (role_id, tool_id)
            VALUES (v_role_record.id, v_tool_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
