-- ==============================================================================
-- MIGRACIÓN: 20261001_create_forms_audit_tool.sql
-- Herramienta Técnica: Consola de Auditoría General de Formularios y Formatos
-- Slug: forms-audit | Categoría: management (Universal para fiscalización y control)
-- ==============================================================================

-- 1. Insertar la herramienta en el catálogo oficial public.tools
INSERT INTO public.tools (slug, name, description, category, is_universal)
VALUES (
    'forms-audit',
    'Auditoría General de Formularios',
    'Consola unificada de fiscalización, trazabilidad y auditoría de archivos para todos los formularios y formatos operativos de PROCIMEC (SIG, GPR, CAD, Compras, Finanzas, HSEQ).',
    'management',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_universal = EXCLUDED.is_universal;

-- 2. Asignar la herramienta a roles directivos y de supervisión
DO $$
DECLARE
    v_tool_id UUID;
    v_role_record RECORD;
BEGIN
    SELECT id INTO v_tool_id FROM public.tools WHERE slug = 'forms-audit' LIMIT 1;

    IF v_tool_id IS NOT NULL THEN
        -- Asignar a roles clave: Gerencia, HSEQ, Finanzas, Contabilidad, Compras, Almacén
        FOR v_role_record IN
            SELECT id FROM public.roles
            WHERE LOWER(name) IN ('gerencia', 'hseq', 'finanzas', 'contabilidad', 'compras', 'almacén', 'almacen')
        LOOP
            INSERT INTO public.role_tools (role_id, tool_id)
            VALUES (v_role_record.id, v_tool_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
