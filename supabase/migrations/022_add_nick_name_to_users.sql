-- ==============================================================================
-- Migración 022: Añadir columna nick_name a la tabla users
-- ==============================================================================
-- Esta migración añade la columna 'nick_name' a la tabla 'users' para permitir
-- un nombre corto / apodo de visualización en el panel de control del usuario,
-- preservando 'full_name' para firmas oficiales, actas, inspecciones y reportes.
-- ==============================================================================

-- 1. Crear la columna nick_name si no existe
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nick_name TEXT;

-- 2. Poblar inicialmente nick_name duplicando el valor actual de full_name
UPDATE public.users
SET nick_name = full_name
WHERE nick_name IS NULL OR nick_name = '';

-- Comentario descriptivo en PostgreSQL
COMMENT ON COLUMN public.users.nick_name IS 'Nombre de visualización / apodo mostrado en el panel del usuario y barra de navegación. full_name se reserva para nombres legales completos en firmas y reportes.';
