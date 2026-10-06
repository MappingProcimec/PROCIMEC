-- ==============================================================================
-- MIGRACIÓN: 20261006_create_document_version_control.sql
-- Herramienta Técnica HSEQ: Control de Versiones y Gestión Documental
-- Plataforma PROCIMEC — PCM CLOUD
-- Listado Maestro de Documentos y Control de Versiones de Formatos
-- (Estructura DDL limpia sin datos precargados para diligenciamiento manual)
-- ==============================================================================

-- 1. Tabla Principal de Formatos y Documentos Controlados
CREATE TABLE IF NOT EXISTS public.document_format_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    process TEXT NOT NULL,
    form_slug TEXT,
    roles_access TEXT[] NOT NULL DEFAULT '{}',
    is_universal BOOLEAN NOT NULL DEFAULT false,
    current_version TEXT NOT NULL DEFAULT '1',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'obsolete', 'draft')),
    category TEXT NOT NULL DEFAULT 'hseq',
    description TEXT,
    download_template_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de Historial de Versiones (Trazabilidad y Control de Cambios)
CREATE TABLE IF NOT EXISTS public.format_version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id UUID NOT NULL REFERENCES public.document_format_versions(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    change_date DATE NOT NULL,
    change_reason TEXT NOT NULL,
    responsible_name TEXT NOT NULL,
    file_url TEXT,
    file_format TEXT NOT NULL DEFAULT 'pdf',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_doc_format_versions_code ON public.document_format_versions(code);
CREATE INDEX IF NOT EXISTS idx_doc_format_versions_process ON public.document_format_versions(process);
CREATE INDEX IF NOT EXISTS idx_doc_format_versions_status ON public.document_format_versions(status);
CREATE INDEX IF NOT EXISTS idx_format_version_history_format_id ON public.format_version_history(format_id);
CREATE INDEX IF NOT EXISTS idx_format_version_history_change_date ON public.format_version_history(change_date DESC);

-- 3. Habilitar Seguridad RLS
ALTER TABLE public.document_format_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.format_version_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_format_versions_read_auth" ON public.document_format_versions;
CREATE POLICY "doc_format_versions_read_auth"
    ON public.document_format_versions
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "doc_format_versions_write_admin_hseq" ON public.document_format_versions;
CREATE POLICY "doc_format_versions_write_admin_hseq"
    ON public.document_format_versions
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'hseq', 'gerencia', 'management') OR u.email LIKE '%procimec%')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'hseq', 'gerencia', 'management') OR u.email LIKE '%procimec%')
    ));

DROP POLICY IF EXISTS "format_version_history_read_auth" ON public.format_version_history;
CREATE POLICY "format_version_history_read_auth"
    ON public.format_version_history
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "format_version_history_write_admin_hseq" ON public.format_version_history;
CREATE POLICY "format_version_history_write_admin_hseq"
    ON public.format_version_history
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'hseq', 'gerencia', 'management') OR u.email LIKE '%procimec%')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
          AND (u.role IN ('admin', 'hseq', 'gerencia', 'management') OR u.email LIKE '%procimec%')
    ));

-- 4. Registrar la Herramienta Oficial en public.tools
INSERT INTO public.tools (slug, name, description, category, is_universal)
VALUES (
    'version-control',
    'Control de Versiones y Gestión Documental',
    'Listado maestro oficial de formatos, control de cambios de versión, trazabilidad documental y descarga de plantillas vigentes del SIG.',
    'hseq',
    false
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_universal = EXCLUDED.is_universal;

-- 5. Vincular a Roles de Supervisión (HSEQ, Gerencia, Admin)
DO $$
DECLARE
    v_tool_id UUID;
    v_role_record RECORD;
BEGIN
    SELECT id INTO v_tool_id FROM public.tools WHERE slug = 'version-control' LIMIT 1;

    IF v_tool_id IS NOT NULL THEN
        FOR v_role_record IN
            SELECT id FROM public.roles
            WHERE LOWER(name) IN ('hseq', 'gerencia', 'admin', 'administrador', 'calidad')
        LOOP
            INSERT INTO public.role_tools (role_id, tool_id)
            VALUES (v_role_record.id, v_tool_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
