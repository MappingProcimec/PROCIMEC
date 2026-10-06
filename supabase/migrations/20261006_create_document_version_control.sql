-- ==============================================================================
-- MIGRACIÓN: 20261006_create_document_version_control.sql
-- Herramienta Técnica HSEQ: Control de Versiones y Gestión Documental
-- Plataforma PROCIMEC — PCM CLOUD
-- Listado Maestro de Documentos y Control de Versiones de Formatos
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

-- 6. Carga Inicial del Listado Maestro de Todos los Formatos de PROCIMEC (25 Formatos Auditados)
DO $$
DECLARE
    v_fmt_id UUID;
BEGIN
    -- 1. FOR-SIG-001: Análisis y Planificación de Cambios
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-SIG-001',
        'Análisis y Planificación de Cambios',
        'HSEQ & SIG',
        'analisis-planificacion-cambios-sig',
        ARRAY['HSEQ', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-10-01',
        'active',
        'hseq',
        'Identificación, evaluación de riesgos, actividades, aprobación y efectividad para cambios que afecten al Sistema Integrado de Gestión.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date,
        description = EXCLUDED.description
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-10-01', 'Emisión inicial oficial del formato para análisis y planificación de cambios bajo norma ISO 9001 / ISO 45001.', 'Dirección HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 2. FOR-HSEQ-024: Inspección Pre-operacional de Drone
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-024',
        'Inspección Pre-operacional de Drone',
        'HSEQ & SIG',
        'hseq-report',
        ARRAY['HSEQ', 'Localizador', 'Admin'],
        false,
        '2',
        '2026-09-16',
        'active',
        'hseq',
        'Inspección pre-operacional obligatoria diaria para equipos aéreos pilotados a distancia (RPA/Drone), control remoto, baterías y sensores.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES 
        (v_fmt_id, '1', '2026-08-15', 'Creación preliminar del formato de chequeo de aeronaves no tripuladas.', 'Coordinación HSEQ', 'xlsx'),
        (v_fmt_id, '2', '2026-09-16', 'Ampliación a 6 secciones técnicas, verificación de frecuencias, gimbal, hélices y firmas digitales.', 'Dirección HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 3. FOR-HSEQ-025: Inspección Pre-operacional de Estación Total
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-025',
        'Inspección Pre-operacional de Estación Total',
        'HSEQ & SIG',
        'hseq-report',
        ARRAY['HSEQ', 'Localizador', 'Dibujo', 'Admin'],
        false,
        '1',
        '2026-09-10',
        'active',
        'hseq',
        'Lista de verificación previa al uso de instrumental de precisión topográfica óptica-electrónica y prisma.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-10', 'Estandarización del formato de inspección de estación total, plomada óptica, compensador y trípode.', 'Coordinación HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 4. FOR-HSEQ-026: Inspección Pre-operacional de GPS Diferencial (GNSS)
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-026',
        'Inspección Pre-operacional de GPS Diferencial (GNSS)',
        'HSEQ & SIG',
        'hseq-report',
        ARRAY['HSEQ', 'Localizador', 'Dibujo', 'Admin'],
        false,
        '1',
        '2026-09-10',
        'active',
        'hseq',
        'Inspección de receptor base, rover, colectora de datos, mástil y enlaces de radio de receptores GNSS.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-10', 'Creación del formato de verificación de equipos GNSS y colectora de datos.', 'Coordinación HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 5. FOR-HSEQ-027: Inspección Pre-operacional de Georadar (GPR)
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-027',
        'Inspección Pre-operacional de Georadar (GPR)',
        'HSEQ & SIG',
        'hseq-report',
        ARRAY['HSEQ', 'Localizador', 'Admin'],
        false,
        '1',
        '2026-09-10',
        'active',
        'hseq',
        'Chequeo de estructura, odómetro de rueda, antena blindada GPR, unidad Akula y computadora de control.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-10', 'Estandarización de inspección física y funcional para unidades GPR Sensors & Software y Akula.', 'Dirección HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 6. FOR-HSEQ-028: Inspección Pre-operacional de Localizador Electromagnético
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-028',
        'Inspección Pre-operacional de Localizador Electromagnético',
        'HSEQ & SIG',
        'hseq-report',
        ARRAY['HSEQ', 'Localizador', 'Admin'],
        false,
        '1',
        '2026-09-10',
        'active',
        'hseq',
        'Inspección técnica de transmisor (TX), receptor (RX), pinzas de inducción y cableado de localizadores electromagnéticos.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-10', 'Creación del checklist preoperacional para equipos electromagnéticos RD8100 y similares.', 'Coordinación HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 7. FOR-HSEQ-029: Inspección Pre-operacional de Vehículo
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-029',
        'Inspección Pre-operacional de Vehículo',
        'HSEQ & SIG',
        'hseq-report',
        ARRAY['Todos los Roles'],
        true,
        '4',
        '2026-09-22',
        'active',
        'hseq',
        'Inspección integral preoperacional de seguridad vial (PESV) para camionetas y vehículos de la empresa.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES 
        (v_fmt_id, '1', '2026-05-10', 'Formato inicial de revisión preoperacional de vehículos.', 'HSEQ', 'xlsx'),
        (v_fmt_id, '2', '2026-07-01', 'Inclusión de kit de derrames, botiquín y extintor según normativa de tránsito.', 'HSEQ', 'xlsx'),
        (v_fmt_id, '3', '2026-08-15', 'Validación estricta de SOAT, tecnomecánica y tarjeta de propiedad.', 'HSEQ', 'xlsx'),
        (v_fmt_id, '4', '2026-09-22', 'Consolidación de 41 ítems en 5 secciones según Plan Estratégico de Seguridad Vial (PESV).', 'Dirección HSEQ', 'xlsx')
    ON CONFLICT DO NOTHING;

    -- 8. FOR-HSEQ-001: Registro de Asistencia Diaria y Preoperacional
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-HSEQ-001',
        'Registro de Asistencia Diaria y Preoperacional',
        'HSEQ & SIG',
        'tools/attendance-tracker',
        ARRAY['Todos los Roles'],
        true,
        '2',
        '2026-10-06',
        'active',
        'hseq',
        'Control de presencia matutina, georreferenciación GPS, aptitud física pre-turno y reporte de salidas intermedias.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES 
        (v_fmt_id, '1', '2026-08-01', 'Planilla manual de registro de asistencia en campo y oficina.', 'Talento Humano / HSEQ', 'pdf'),
        (v_fmt_id, '2', '2026-10-06', 'Digitalización completa con geolocalización satelital, registro de pausas y salidas intermedias.', 'Gerencia Técnica', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 9. FOR-GPR-001: Reporte Diario de Campo y Exploración GPR
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-GPR-001',
        'Reporte Diario de Campo y Exploración GPR',
        'Operaciones GPR / Geofísica',
        'gpr-field-form',
        ARRAY['Localizador', 'Admin'],
        false,
        '2',
        '2026-10-06',
        'active',
        'gpr',
        'Reporte operacional de exploración en campo, metros lineales levantados, condiciones climáticas y soporte de hallazgos.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES 
        (v_fmt_id, '1', '2026-08-20', 'Formato inicial de reporte de metros lineales por frente de trabajo.', 'Operaciones', 'pdf'),
        (v_fmt_id, '2', '2026-10-06', 'Incorporación de asignación de prioridad CAD, fotografías en Google Drive y georreferenciación.', 'Operaciones GPR', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 10. FOR-CAD-001: Bitácora de Modelado y Producción CAD / BIM
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-CAD-001',
        'Bitácora de Modelado y Producción CAD / BIM',
        'Ingeniería y Dibujo CAD/BIM',
        'cad-register-form',
        ARRAY['Dibujo', 'Admin'],
        false,
        '2',
        '2026-10-06',
        'active',
        'cad',
        'Registro de actividades de modelado, planimetría, Civil 3D, fases de entrega y control de reprocesos.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES 
        (v_fmt_id, '1', '2026-08-20', 'Registro básico de horas hombre y planos generados.', 'Líder Dibujo', 'pdf'),
        (v_fmt_id, '2', '2026-10-06', 'Control de etapas (Inicio/Proceso/Final), software utilizado y causa raíz de reprocesos.', 'Coordinación CAD', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 11. FOR-ALM-001: Entrada y Registro de Instrumental
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-ALM-001',
        'Entrada y Registro de Instrumental',
        'Almacén y Logística',
        'registro-equipo',
        ARRAY['Almacén', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'warehouse',
        'Ficha técnica de caracterización, serial, marca, estado operativo y calibración metrológica de equipos al ingresar al inventario.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Estandarización de ficha de alta de activos e instrumental en kárdex.', 'Jefatura de Almacén', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 12. FOR-ALM-002: Acta de Despacho y Salida de Equipos a Campo
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-ALM-002',
        'Acta de Despacho y Salida de Equipos a Campo',
        'Almacén y Logística',
        'despacho-equipo',
        ARRAY['Almacén', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'warehouse',
        'Acta de entrega y custodia de instrumental asignado a localizadores para comisiones de campo.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Emisión oficial de acta de remisión de equipos con verificación de accesorios y firma de recepción.', 'Jefatura de Almacén', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 13. FOR-ALM-003: Acta de Retorno y Devolución de Instrumental
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-ALM-003',
        'Acta de Retorno y Devolución de Instrumental',
        'Almacén y Logística',
        'retorno-equipo',
        ARRAY['Almacén', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'warehouse',
        'Acta de recepción física, inspección de estado y reporte de novedades al regresar equipos de campo.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Formato oficial de recepción y diagnóstico de reintegro a bodega.', 'Jefatura de Almacén', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 14. FOR-COM-001: Solicitud Interna de Requerimiento de Compras
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-COM-001',
        'Solicitud Interna de Requerimiento de Compras',
        'Compras y Adquisiciones',
        'requerimiento-compra',
        ARRAY['Todos los Roles'],
        true,
        '2',
        '2026-10-02',
        'active',
        'purchasing',
        'Petición formal de insumos, consumibles, herramientas o servicios requeridos por proyectos o áreas.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES 
        (v_fmt_id, '1', '2026-09-24', 'Formato inicial de requerimiento de compras con lista de ítems.', 'Coordinación Compras', 'pdf'),
        (v_fmt_id, '2', '2026-10-02', 'Incorporación de imputación por centro de costos, cédula del solicitante y aprobador de proyecto.', 'Gerencia Administrativa', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 15. FOR-COM-002: Orden de Compra y Adjudicación de Proveedor
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-COM-002',
        'Orden de Compra y Adjudicación de Proveedor',
        'Compras y Adquisiciones',
        'orden-compra',
        ARRAY['Compras', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'purchasing',
        'Documento formal de orden de compra, proveedor adjudicado, condiciones de pago, garantías y montos aprobados.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Emisión oficial de plantilla de Orden de Compra (OC) vinculante.', 'Coordinación Compras', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 16. FOR-COM-003: Evaluación y Calificación de Proveedores
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-COM-003',
        'Evaluación y Calificación de Proveedores',
        'Compras y Adquisiciones',
        'evaluacion-proveedor',
        ARRAY['Compras', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'purchasing',
        'Matriz de calificación de calidad de bienes, tiempos de entrega y nivel de servicio post-venta.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Implementación de evaluación periódica de proveedores según estándar ISO 9001.', 'Compras / Calidad', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 17. FOR-CMR-001: Ficha de Registro de Oportunidad y Licitación
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-CMR-001',
        'Ficha de Registro de Oportunidad y Licitación',
        'Gestión Comercial',
        'registro-oportunidad',
        ARRAY['Comercial', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'commercial',
        'Captura de requerimientos de clientes, pliegos licitatorios, presupuesto estimado y fechas límite de propuesta.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Creación del formato de entrada de prospectos y licitaciones al pipeline.', 'Dirección Comercial', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 18. FOR-CMR-002: Cotización Comercial y Oferta Económica
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-CMR-002',
        'Cotización Comercial y Oferta Económica',
        'Gestión Comercial',
        'cotizacion-comercial',
        ARRAY['Comercial', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'commercial',
        'Estructura de propuesta económica y técnica presentada al cliente, discriminación de IVA y validez de oferta.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Estandarización de formato para ofertas comerciales formales.', 'Dirección Comercial', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 19. FOR-CMR-003: Acta de Cierre de Negociación y Adjudicación
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-CMR-003',
        'Acta de Cierre de Negociación y Adjudicación',
        'Gestión Comercial',
        'cierre-comercial',
        ARRAY['Comercial', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'commercial',
        'Registro del desenlace comercial de la oferta: adjudicada, perdida ante competencia o declarada desierta.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Registro de desenlace contractual y lecciones aprendidas de licitación.', 'Dirección Comercial', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 20. FOR-FIN-001: Solicitud de Viáticos y Anticipos
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-FIN-001',
        'Solicitud de Viáticos y Anticipos',
        'Finanzas y Tesorería',
        'solicitud-viaticos',
        ARRAY['Todos los Roles'],
        true,
        '1',
        '2026-09-24',
        'active',
        'finance',
        'Petición formal de fondos para comisiones de campo, transporte, hospedaje, alimentación y peajes.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Estandarización de formato de solicitud de fondos para comisiones técnicas.', 'Tesorería', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 21. FOR-FIN-002: Legalización y Rendición de Gastos
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-FIN-002',
        'Legalización y Rendición de Gastos',
        'Finanzas y Tesorería',
        'legalizacion-gastos',
        ARRAY['Todos los Roles'],
        true,
        '1',
        '2026-09-24',
        'active',
        'finance',
        'Rendición pormenorizada de comprobantes de gastos ejecutados contra anticipos recibidos y determinación de saldo.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Planilla oficial de legalización de viáticos y soportes tributarios de egreso.', 'Tesorería', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 22. FOR-FIN-003: Comprobante de Egreso y Pago
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-FIN-003',
        'Comprobante de Egreso y Pago',
        'Finanzas y Tesorería',
        'registro-pago',
        ARRAY['Finanzas', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'finance',
        'Captura de comprobante bancario, transferencias realizadas y soportes contables de desembolso.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Formato de comprobante de egreso y transferencia bancaria.', 'Tesorería', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 23. FOR-CNT-001: Radicación de Factura Proveedor
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-CNT-001',
        'Radicación de Factura Proveedor',
        'Contabilidad',
        'radicacion-factura',
        ARRAY['Contabilidad', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'accounting',
        'Entrada y registro de facturas de proveedores para trámite de causación, retención en la fuente y pago programado.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Control contable de radicación de facturas electrónicas.', 'Contabilidad', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 24. FOR-CNT-002: Acta de Corte de Obra y Soporte de Facturación
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-CNT-002',
        'Acta de Corte de Obra y Soporte de Facturación',
        'Contabilidad',
        'soporte-cobro',
        ARRAY['Contabilidad', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'accounting',
        'Registro de corte de obra, metros lineales ejecutados y actas de interventoría aprobadas para facturar al cliente.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Acta formal de entrega parcial o final para radicación de cuenta de cobro / factura al cliente.', 'Contabilidad / Gerencia', 'pdf')
    ON CONFLICT DO NOTHING;

    -- 25. FOR-TH-001: Certificación Laboral
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-001',
        'Certificación Laboral',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Acreditación formal de vínculo laboral, cargo, salario devengado, antigüedad y tipo de contrato con firma autorizada.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date,
        description = EXCLUDED.description
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Estandarización de modelo institucional de certificación laboral con validación de radicado.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

    -- 26. FOR-TH-002: Presentación de Personal en Obra
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-002',
        'Presentación de Personal en Obra',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Presentación formal de colaboradores ante clientes o interventoría con afiliaciones de seguridad social y ARL de frente.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Formato oficial de acreditación ante interventoría en frentes operativos.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

    -- 27. FOR-TH-003: Vinculación a Proyecto / Obra
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-003',
        'Vinculación a Proyecto / Obra',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Asignación oficial a frente de trabajo, condiciones del contrato, jefe inmediato y entrega de dotación y EPP.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Formato de asignación y traslado operativo de personal a contratos vigentes.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

    -- 28. FOR-TH-004: Terminación de Contrato de Trabajo
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-004',
        'Terminación de Contrato de Trabajo',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Comunicación formal de finalización de relación laboral conforme a la legislación vigente y liquidación de prestaciones.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Notificación formal de liquidación y desvinculación laboral conforme al Código Sustantivo del Trabajo.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

    -- 29. FOR-TH-005: Paz y Salvo Laboral
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-005',
        'Paz y Salvo Laboral',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Constancia de entrega formal de dotación, equipos técnicos, reintegro de herramientas, celular corporativo y carnet.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Validación de reintegro de activos de la empresa al terminar vínculo laboral.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

    -- 30. FOR-TH-006: Permiso Laboral y Licencias
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-006',
        'Permiso Laboral y Licencias',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Autorización y constancia formal de ausencias laborales, citas médicas o licencias temporales aprobadas.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Registro de permisos y justificaciones médicas de colaboradores.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

    -- 31. FOR-TH-007: Solicitud a Entidad Externa
    INSERT INTO public.document_format_versions (code, name, process, form_slug, roles_access, is_universal, current_version, effective_date, status, category, description)
    VALUES (
        'FOR-TH-007',
        'Solicitud a Entidad Externa',
        'Gestión del Talento Humano',
        'elaboracion-cartas',
        ARRAY['RRHH', 'Gerencia', 'Admin'],
        false,
        '1',
        '2026-09-24',
        'active',
        'rrhh',
        'Oficio formal institucional dirigido a entidades públicas, bancos o clientes con representación legal de PROCIMEC.'
    )
    ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        process = EXCLUDED.process,
        roles_access = EXCLUDED.roles_access,
        current_version = EXCLUDED.current_version,
        effective_date = EXCLUDED.effective_date
    RETURNING id INTO v_fmt_id;

    INSERT INTO public.format_version_history (format_id, version, change_date, change_reason, responsible_name, file_format)
    VALUES (v_fmt_id, '1', '2026-09-24', 'Comunicaciones corporativas formales con entidades externas.', 'Talento Humano', 'docx')
    ON CONFLICT DO NOTHING;

END $$;

