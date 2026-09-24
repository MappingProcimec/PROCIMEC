-- ==============================================================================
-- CAPA 2: Habilitar Roles Base Restantes
-- Registra la identidad y constraints de: Compras, Comercial, Finanzas, Contabilidad, Gerencia
-- ==============================================================================

-- 1. Actualizar el constraint de users para admitir los 6 nuevos roles corporativos
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN (
    'admin', 
    'localizador', 
    'operator', 
    'pending', 
    'dibujo', 
    'drawing', 
    'hr', 
    'hseq', 
    'warehouse', 
    'purchasing', 
    'commercial', 
    'finance', 
    'accounting', 
    'management'
  ));

-- 2. Insertar los roles formales en la tabla public.roles (si no existen)
INSERT INTO public.roles (name, division_id, is_system_role)
SELECT 'Compras', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE LOWER(name) IN ('compras', 'purchasing', 'adquisiciones')
);

INSERT INTO public.roles (name, division_id, is_system_role)
SELECT 'Comercial', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE LOWER(name) IN ('comercial', 'commercial', 'ventas')
);

INSERT INTO public.roles (name, division_id, is_system_role)
SELECT 'Finanzas', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE LOWER(name) IN ('finanzas', 'finance', 'tesoreria')
);

INSERT INTO public.roles (name, division_id, is_system_role)
SELECT 'Contabilidad', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE LOWER(name) IN ('contabilidad', 'accounting', 'contador')
);

INSERT INTO public.roles (name, division_id, is_system_role)
SELECT 'Gerencia', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE LOWER(name) IN ('gerencia', 'management', 'gerente', 'direccion')
);
