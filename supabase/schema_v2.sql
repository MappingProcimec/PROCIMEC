-- ============================================================
-- PROCIMEC — Supabase Schema v2
-- Mapping Ingeniería — Extensión multi-división con roles dinámicos
--
-- IMPORTANTE: Ejecutar DESPUÉS de schema.sql. No reemplaza el
-- schema original — extiende la base de datos existente.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ENUM: tool_category
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tool_category AS ENUM ('gpr', 'cad', 'admin', 'universal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- TABLA: divisions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS divisions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: roles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  division_id    UUID        REFERENCES divisions(id) ON DELETE SET NULL,
  is_system_role BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: tools
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tools (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT          UNIQUE NOT NULL,
  name         TEXT          NOT NULL,
  description  TEXT,
  category     tool_category NOT NULL,
  is_universal BOOLEAN       NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: role_tools  (herramientas asignadas a un rol)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_tools (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, tool_id)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: role_projects  (proyectos habilitados para un rol)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_projects (
  role_id    UUID REFERENCES roles(id)    ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, project_id)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: forms  (catálogo de formularios de la plataforma)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        UNIQUE NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT,
  steps_count     INT         NOT NULL DEFAULT 1,
  has_attachments BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: role_forms  (formularios habilitados para un rol)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_forms (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, form_id)
);

-- ─────────────────────────────────────────────────────────────
-- MODIFICAR users: agregar role_id y division_id
--
-- La columna `role` (text) se mantiene intacta para
-- compatibilidad con el código existente hasta que la migración
-- a role_id esté completa en toda la aplicación.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_id     UUID REFERENCES roles(id)     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_roles_division        ON roles(division_id);
CREATE INDEX IF NOT EXISTS idx_tools_category        ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_slug            ON tools(slug);
CREATE INDEX IF NOT EXISTS idx_role_tools_role       ON role_tools(role_id);
CREATE INDEX IF NOT EXISTS idx_role_tools_tool       ON role_tools(tool_id);
CREATE INDEX IF NOT EXISTS idx_role_projects_role    ON role_projects(role_id);
CREATE INDEX IF NOT EXISTS idx_role_projects_project ON role_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_role_forms_role       ON role_forms(role_id);
CREATE INDEX IF NOT EXISTS idx_role_forms_form       ON role_forms(form_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id         ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_division_id     ON users(division_id);

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: updated_at en divisions
-- Reutiliza la función update_updated_at_column() definida
-- en schema.sql — no se redefine aquí.
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS divisions_updated_at ON divisions;
CREATE TRIGGER divisions_updated_at
  BEFORE UPDATE ON divisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
--
-- Patrón uniforme:
--   SELECT → cualquier usuario autenticado (auth.uid() IS NOT NULL)
--   ALL    → solo admin (role = 'admin' en la tabla users)
--
-- Mantiene la columna `role` text para el check de admin,
-- igual que el schema.sql original.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE divisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools        ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_tools   ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_forms   ENABLE ROW LEVEL SECURITY;

-- ── divisions ─────────────────────────────────────────────────
CREATE POLICY "divisions_select_authenticated" ON divisions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "divisions_admin_write" ON divisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── roles ─────────────────────────────────────────────────────
CREATE POLICY "roles_select_authenticated" ON roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "roles_admin_write" ON roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── tools ─────────────────────────────────────────────────────
CREATE POLICY "tools_select_authenticated" ON tools
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tools_admin_write" ON tools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── role_tools ────────────────────────────────────────────────
CREATE POLICY "role_tools_select_authenticated" ON role_tools
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "role_tools_admin_write" ON role_tools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── role_projects ─────────────────────────────────────────────
CREATE POLICY "role_projects_select_authenticated" ON role_projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "role_projects_admin_write" ON role_projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── forms ─────────────────────────────────────────────────────
CREATE POLICY "forms_select_authenticated" ON forms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "forms_admin_write" ON forms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── role_forms ────────────────────────────────────────────────
CREATE POLICY "role_forms_select_authenticated" ON role_forms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "role_forms_admin_write" ON role_forms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- DATOS SEMILLA: tools
-- ON CONFLICT DO NOTHING → idempotente, seguro re-ejecutar
-- ─────────────────────────────────────────────────────────────
INSERT INTO tools (slug, name, category, is_universal) VALUES
  -- GPR ──────────────────────────────────────────────────────
  ('gpr-field-form',         'Formulario de Campo Mapping',                'gpr',       false),
  ('gsf-processor',          'Procesador Web de Radargramas (.gsf)',        'gpr',       false),
  ('txt-dwg-viewer',         'Previsualizador TXT y Exportador DWG',        'gpr',       false),
  ('docx-generator',         'Generador de Reportes Técnicos (.docx)',      'gpr',       false),
  ('backup-script-gen',      'Generador de Scripts de Respaldo Local',      'gpr',       false),
  -- CAD/BIM ─────────────────────────────────────────────────
  ('cad-register-form',      'Formulario de Registro CAD/BIM',              'cad',       false),
  ('cad-productivity-board', 'Tablero de Productividad CAD/BIM',            'cad',       false),
  -- Admin ───────────────────────────────────────────────────
  ('gis-viewer',             'Base de Datos GIS Integrada (2D/3D)',         'admin',     false),
  ('internal-chat',          'Chat Interno y Conversión a Tareas',          'admin',     false),
  ('meeting-transcriber',    'Módulo de Reuniones y Transcripción',         'admin',     false),
  ('org-chart-ai',           'Organigrama Interactivo con IA',              'admin',     false),
  -- Universal ───────────────────────────────────────────────
  ('dynamic-dashboard',      'Dashboard Dinámico',                          'universal', true),
  ('projects-area',          'Área de Proyectos',                           'universal', true),
  ('forms-area',             'Área de Formularios',                         'universal', true)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- DATOS SEMILLA: forms
-- ─────────────────────────────────────────────────────────────
INSERT INTO forms (slug, name, steps_count, has_attachments) VALUES
  ('gpr-field-form',    'Formulario de Campo GPR',        2, true),
  ('cad-register-form', 'Formulario de Registro CAD/BIM', 2, false)
ON CONFLICT (slug) DO NOTHING;
