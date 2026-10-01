-- ==============================================================================
-- MIGRACIÓN: 20261001_create_sig_management_changes.sql
-- Formulario Oficial: ANÁLISIS Y PLANIFICACIÓN DE LOS CAMBIOS QUE AFECTEN AL SIG
-- Código Canónico: FOR-SIG-001 | Versión: 1
-- Google Drive Plantilla Viva: 1wTRLk90fdyMPoDywI0hLYC3O4-ekDlyq
-- ==============================================================================

-- 1. Crear tabla operacional para registro de cambios del SIG
CREATE TABLE IF NOT EXISTS public.sig_management_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'closed')),
    official_code TEXT NOT NULL DEFAULT 'FOR-SIG-001',
    version TEXT NOT NULL DEFAULT '1',
    cloud_drive_file_id TEXT NOT NULL DEFAULT '1wTRLk90fdyMPoDywI0hLYC3O4-ekDlyq',
    
    -- Sección 1: Identificación y Análisis del Cambio
    identifier_name TEXT NOT NULL,
    identifier_position TEXT NOT NULL,
    identifier_process TEXT NOT NULL,
    identification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    change_description TEXT NOT NULL,
    justification TEXT NOT NULL,
    affected_processes TEXT NOT NULL,
    
    -- Orígenes seleccionados (array JSONB con los códigos de origen marcados con X)
    origins JSONB NOT NULL DEFAULT '[]'::jsonb,
    origins_other TEXT,
    
    -- Sección 2: Equipo de Trabajo (array JSONB de objetos { nombre, cargo, proceso })
    work_team JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Sección 3: Análisis de Riesgos y Oportunidades (array JSONB de objetos { descripcion_efectos, tipo, controles_acciones })
    risks JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Sección 4: Plan de Implementación / Actividades (array JSONB de objetos { actividad, responsable, fecha_limite, producto_esperado })
    activities JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Sección 5: Aprobación y Seguimiento
    approval_name TEXT,
    approval_position TEXT,
    approval_process TEXT,
    approval_signature TEXT,
    tracking_name TEXT,
    tracking_position TEXT,
    tracking_process TEXT,
    tracking_signature TEXT,
    
    -- Sección 6: Efectividad del Cambio
    control_risks_controlled BOOLEAN,
    change_effective BOOLEAN,
    effectiveness_notes_no TEXT
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_sig_management_changes_user_id ON public.sig_management_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_sig_management_changes_project_id ON public.sig_management_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_sig_management_changes_created_at ON public.sig_management_changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sig_management_changes_status ON public.sig_management_changes(status);

-- 2. Habilitar Seguridad RLS
ALTER TABLE public.sig_management_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sig_management_changes_read_authenticated" ON public.sig_management_changes;
CREATE POLICY "sig_management_changes_read_authenticated"
    ON public.sig_management_changes
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "sig_management_changes_insert_authenticated" ON public.sig_management_changes;
CREATE POLICY "sig_management_changes_insert_authenticated"
    ON public.sig_management_changes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    ));

DROP POLICY IF EXISTS "sig_management_changes_update_user_admin" ON public.sig_management_changes;
CREATE POLICY "sig_management_changes_update_user_admin"
    ON public.sig_management_changes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    ));

-- 3. Registrar el Formulario en el Catálogo de public.forms
INSERT INTO public.forms (slug, name, description, steps_count, has_attachments, schema)
VALUES (
    'analisis-planificacion-cambios-sig',
    'Análisis y Planificación de Cambios SIG',
    'Identificación, evaluación de riesgos, actividades, aprobación y efectividad para cambios que afecten al SIG (FOR-SIG-001).',
    5,
    false,
    jsonb_build_object(
        'code', 'FOR-SIG-001',
        'version', '1',
        'cloud_provider', 'google_drive',
        'template_drive_file_id', '1wTRLk90fdyMPoDywI0hLYC3O4-ekDlyq',
        'target_table', 'sig_management_changes'
    )
)
ON CONFLICT (slug) DO UPDATE
SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    schema = EXCLUDED.schema;

-- 4. Vincular el Formulario a los Roles HSEQ y Admin en public.role_forms
INSERT INTO public.role_forms (role_id, form_id)
SELECT r.id, f.id
FROM public.roles r
CROSS JOIN public.forms f
WHERE r.name IN ('hseq', 'admin', 'HSEQ', 'Administrador')
  AND f.slug = 'analisis-planificacion-cambios-sig'
ON CONFLICT DO NOTHING;
