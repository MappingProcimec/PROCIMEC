-- ==============================================================================
-- MIGRACIÓN: 20261021_create_dev_tickets_system.sql
-- Sistema Autónomo de Tickets Técnicos, Planificación IA y DevOps Cíclico
-- Plataforma PROCIMEC — PCM CLOUD
-- ==============================================================================

-- 1. Tabla Principal de Tickets de Desarrollo Autónomo
CREATE TABLE IF NOT EXISTS public.dev_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending_spec' 
        CHECK (status IN (
            'pending_spec',
            'awaiting_approval',
            'approved',
            'in_progress',
            'verifying',
            'completed',
            'failed',
            'cancelled'
        )),
    technical_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    feedback_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    commit_hash TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de Logs de Ejecución en Tiempo Real (Terminal Runner)
CREATE TABLE IF NOT EXISTS public.dev_ticket_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.dev_tickets(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de Alto Rendimiento
CREATE INDEX IF NOT EXISTS idx_dev_tickets_status ON public.dev_tickets(status);
CREATE INDEX IF NOT EXISTS idx_dev_tickets_user_id ON public.dev_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_dev_tickets_created_at ON public.dev_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_ticket_logs_ticket_id ON public.dev_ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_dev_ticket_logs_created_at ON public.dev_ticket_logs(created_at ASC);

-- 4. Habilitar Seguridad RLS
ALTER TABLE public.dev_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_ticket_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para dev_tickets
DROP POLICY IF EXISTS "dev_tickets_read_policy" ON public.dev_tickets;
CREATE POLICY "dev_tickets_read_policy"
    ON public.dev_tickets
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.role IN ('admin', 'gerencia', 'management') OR u.email LIKE '%procimec%')
        )
    );

DROP POLICY IF EXISTS "dev_tickets_insert_policy" ON public.dev_tickets;
CREATE POLICY "dev_tickets_insert_policy"
    ON public.dev_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dev_tickets_update_policy" ON public.dev_tickets;
CREATE POLICY "dev_tickets_update_policy"
    ON public.dev_tickets
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.role IN ('admin', 'gerencia', 'management') OR u.email LIKE '%procimec%')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.role IN ('admin', 'gerencia', 'management') OR u.email LIKE '%procimec%')
        )
    );

-- Políticas para dev_ticket_logs
DROP POLICY IF EXISTS "dev_ticket_logs_read_policy" ON public.dev_ticket_logs;
CREATE POLICY "dev_ticket_logs_read_policy"
    ON public.dev_ticket_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.dev_tickets t
            WHERE t.id = dev_ticket_logs.ticket_id
              AND (
                  t.user_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.users u 
                      WHERE u.id = auth.uid() 
                        AND (u.role IN ('admin', 'gerencia', 'management') OR u.email LIKE '%procimec%')
                  )
              )
        )
    );

DROP POLICY IF EXISTS "dev_ticket_logs_write_policy" ON public.dev_ticket_logs;
CREATE POLICY "dev_ticket_logs_write_policy"
    ON public.dev_ticket_logs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
              AND (u.role IN ('admin', 'gerencia', 'management') OR u.email LIKE '%procimec%')
        )
    );

-- 5. Registrar la Herramienta Oficial en public.tools
INSERT INTO public.tools (slug, name, description, category, is_universal)
VALUES (
    'dev-tickets',
    'Tickets y DevOps Autónomo',
    'Plataforma de tickets de mejora, especificación asistida por IA, aprobación vía WhatsApp y orquestación con runner local.',
    'management',
    false
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_universal = EXCLUDED.is_universal;

-- 6. Vincular a Roles Administrativos (Admin, Gerencia)
DO $$
DECLARE
    v_tool_id UUID;
    v_role_record RECORD;
BEGIN
    SELECT id INTO v_tool_id FROM public.tools WHERE slug = 'dev-tickets' LIMIT 1;

    IF v_tool_id IS NOT NULL THEN
        FOR v_role_record IN
            SELECT id FROM public.roles
            WHERE LOWER(name) IN ('admin', 'administrador', 'gerencia', 'management')
        LOOP
            INSERT INTO public.role_tools (role_id, tool_id)
            VALUES (v_role_record.id, v_tool_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- 7. Habilitar Supabase Realtime para escucha de tickets y logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'dev_tickets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_tickets;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'dev_ticket_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_ticket_logs;
    END IF;
END $$;
