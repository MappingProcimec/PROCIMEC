-- ==============================================================================
-- CAPA 1: Habilitar Rol Base Almacén (warehouse)
-- Solo registra la identidad del rol sin tablas de datos ni herramientas aún.
-- ==============================================================================

-- 1. Actualizar el constraint de users para admitir 'warehouse'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'localizador', 'operator', 'pending', 'dibujo', 'drawing', 'hr', 'hseq', 'warehouse'));

-- 2. Insertar el rol 'Almacén' en la tabla roles (si no existe)
INSERT INTO public.roles (name, division_id, is_system_role)
SELECT 'Almacén', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE LOWER(name) IN ('almacén', 'almacen', 'warehouse', 'almacenista')
);
