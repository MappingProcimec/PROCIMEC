-- ==============================================================================
-- Migración 021: Registrar Rol RRHH (Recursos Humanos) y Categoría de Herramientas
-- ==============================================================================

-- 1. Extender ENUM tool_category con valor 'rrhh'
ALTER TYPE tool_category ADD VALUE IF NOT EXISTS 'rrhh';

-- 2. Actualizar categoría de Control de Asistencia a 'rrhh'
UPDATE tools
SET category = 'rrhh'
WHERE slug = 'attendance-tracker';

-- 3. Crear el Rol RRHH (Rol Global, division_id = NULL)
DO $$
DECLARE
  v_role_id uuid;
  v_tool_id uuid;
BEGIN
  -- Insertar o recuperar el rol RRHH
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'RRHH') THEN
    INSERT INTO roles (name, division_id, is_system_role)
    VALUES ('RRHH', NULL, false)
    RETURNING id INTO v_role_id;
  ELSE
    SELECT id INTO v_role_id FROM roles WHERE name = 'RRHH' LIMIT 1;
  END IF;

  -- 4. Asignar herramientas por defecto a RRHH
  -- a. Control de Asistencia y Jornada (attendance-tracker)
  SELECT id INTO v_tool_id FROM tools WHERE slug = 'attendance-tracker' LIMIT 1;
  IF v_tool_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM role_tools WHERE role_id = v_role_id AND tool_id = v_tool_id) THEN
    INSERT INTO role_tools (role_id, tool_id) VALUES (v_role_id, v_tool_id);
  END IF;

  -- b. Organigrama Interactivo con IA (org-chart-ai)
  SELECT id INTO v_tool_id FROM tools WHERE slug = 'org-chart-ai' LIMIT 1;
  IF v_tool_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM role_tools WHERE role_id = v_role_id AND tool_id = v_tool_id) THEN
    INSERT INTO role_tools (role_id, tool_id) VALUES (v_role_id, v_tool_id);
  END IF;

  -- c. Dashboard Dinámico (dynamic-dashboard)
  SELECT id INTO v_tool_id FROM tools WHERE slug = 'dynamic-dashboard' LIMIT 1;
  IF v_tool_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM role_tools WHERE role_id = v_role_id AND tool_id = v_tool_id) THEN
    INSERT INTO role_tools (role_id, tool_id) VALUES (v_role_id, v_tool_id);
  END IF;

  -- d. Chat Interno y Conversión a Tareas (internal-chat)
  SELECT id INTO v_tool_id FROM tools WHERE slug = 'internal-chat' LIMIT 1;
  IF v_tool_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM role_tools WHERE role_id = v_role_id AND tool_id = v_tool_id) THEN
    INSERT INTO role_tools (role_id, tool_id) VALUES (v_role_id, v_tool_id);
  END IF;

  -- e. Módulo de Reuniones y Transcripción (meeting-transcriber)
  SELECT id INTO v_tool_id FROM tools WHERE slug = 'meeting-transcriber' LIMIT 1;
  IF v_tool_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM role_tools WHERE role_id = v_role_id AND tool_id = v_tool_id) THEN
    INSERT INTO role_tools (role_id, tool_id) VALUES (v_role_id, v_tool_id);
  END IF;

END $$;
