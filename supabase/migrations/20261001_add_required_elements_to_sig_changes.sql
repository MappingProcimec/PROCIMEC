-- ==============================================================================
-- MIGRACIÓN: 20261001_add_required_elements_to_sig_changes.sql
-- Formato Oficial: FOR-SIG-001 (Versión 1)
-- Campo: Elementos requeridos para el cambio (tecnológicos, financieros, etc.)
-- ==============================================================================

ALTER TABLE public.sig_management_changes 
ADD COLUMN IF NOT EXISTS required_elements JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sig_management_changes.required_elements IS 'Lista de elementos requeridos para el cambio (tecnológicos, financieros, humanos, físicos, documental, servicios externos, tiempo)';
