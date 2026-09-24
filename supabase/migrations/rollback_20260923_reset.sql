-- ==============================================================================
-- SCRIPT DE LIMPIEZA FINAL DE SUPABASE (PROCIMEC)
-- Elimina los roles, herramientas y formularios extra creados en esta sesión.
-- Deja únicamente la información original previa.
-- ==============================================================================

-- 1. Eliminar asignaciones de herramientas no originales
DELETE FROM public.role_tools WHERE tool_id IN (
  SELECT id FROM public.tools WHERE slug NOT IN (
    'gpr-field-form',
    'gsf-processor',
    'txt-dwg-viewer',
    'docx-generator',
    'backup-script-gen',
    'cad-register-form',
    'cad-productivity-board',
    'gis-viewer',
    'internal-chat',
    'meeting-transcriber',
    'org-chart-ai',
    'dynamic-dashboard',
    'attendance-tracker',
    'evidence-board',
    'cartas-audit',
    'elaboracion-cartas'
  )
);

-- 2. Eliminar herramientas no originales del catálogo
DELETE FROM public.tools WHERE slug NOT IN (
  'gpr-field-form',
  'gsf-processor',
  'txt-dwg-viewer',
  'docx-generator',
  'backup-script-gen',
  'cad-register-form',
  'cad-productivity-board',
  'gis-viewer',
  'internal-chat',
  'meeting-transcriber',
  'org-chart-ai',
  'dynamic-dashboard',
  'attendance-tracker',
  'evidence-board',
  'cartas-audit',
  'elaboracion-cartas'
);

-- 3. Eliminar asignaciones de formularios no originales
DELETE FROM public.role_forms WHERE form_id IN (
  SELECT id FROM public.forms WHERE slug NOT IN (
    'gpr-field-form',
    'cad-register-form',
    'hseq-report',
    'elaboracion-cartas'
  )
);

-- 4. Eliminar formularios no originales del catálogo
DELETE FROM public.forms WHERE slug NOT IN (
  'gpr-field-form',
  'cad-register-form',
  'hseq-report',
  'elaboracion-cartas'
);

-- 5. Eliminar vínculos en tablas intermedias de los roles que no son los 4 originales
DELETE FROM public.role_tools WHERE role_id IN (
  SELECT id FROM public.roles WHERE name NOT IN ('Localizador', 'Dibujo', 'HSEQ', 'RRHH')
);

DELETE FROM public.role_forms WHERE role_id IN (
  SELECT id FROM public.roles WHERE name NOT IN ('Localizador', 'Dibujo', 'HSEQ', 'RRHH')
);

DELETE FROM public.role_projects WHERE role_id IN (
  SELECT id FROM public.roles WHERE name NOT IN ('Localizador', 'Dibujo', 'HSEQ', 'RRHH')
);

DELETE FROM public.user_division_roles WHERE role_id IN (
  SELECT id FROM public.roles WHERE name NOT IN ('Localizador', 'Dibujo', 'HSEQ', 'RRHH')
);

-- 6. Eliminar todos los roles creados en esta sesión (deja exactamente: Localizador, Dibujo, HSEQ y RRHH)
DELETE FROM public.roles WHERE name NOT IN ('Localizador', 'Dibujo', 'HSEQ', 'RRHH');

-- 7. Asegurar que en users estén los roles canónicos originales
UPDATE public.users SET role = 'dibujo' WHERE role = 'drawing';
UPDATE public.users SET role = 'localizador' WHERE role = 'operator';
