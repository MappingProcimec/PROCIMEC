-- ==============================================================================
-- MIGRACIÓN IDEMPOTENTE: Vinculación de Proyecto y Modo de Deliberación en Cierres Comerciales
-- Permite asociar cierres formales directamente a proyectos y registrar el modo de sincronización
-- ==============================================================================

DO $$
BEGIN
    -- 1. Agregar project_id a commercial_closings si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'commercial_closings' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE public.commercial_closings
            ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
    END IF;

    -- 2. Agregar sync_mode a commercial_closings si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'commercial_closings' 
        AND column_name = 'sync_mode'
    ) THEN
        ALTER TABLE public.commercial_closings
            ADD COLUMN sync_mode TEXT DEFAULT 'sync_to_quote';
    END IF;
END $$;

-- 3. Crear índice para optimizar consultas de cierres por proyecto
CREATE INDEX IF NOT EXISTS idx_commercial_closings_project ON public.commercial_closings(project_id);
