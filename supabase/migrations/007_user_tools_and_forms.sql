-- ─────────────────────────────────────────────────────────────
-- MIGRACIÓN 007: ASIGNACIÓN INDIVIDUAL DE HERRAMIENTAS Y FORMULARIOS A USUARIOS
-- Permite que un usuario específico tenga herramientas y formularios asignados
-- de forma personalizada e independiente o adicional a su rol.
-- ─────────────────────────────────────────────────────────────

-- 1. Tabla para herramientas asignadas a usuarios específicos
CREATE TABLE IF NOT EXISTS user_tools (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tool_id)
);

-- 2. Tabla para formularios asignados a usuarios específicos
CREATE TABLE IF NOT EXISTS user_forms (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, form_id)
);

-- 3. Índices para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_user_tools_user ON user_tools(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tools_tool ON user_tools(tool_id);

CREATE INDEX IF NOT EXISTS idx_user_forms_user ON user_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_forms_form ON user_forms(form_id);

-- 4. Políticas de Seguridad RLS
ALTER TABLE user_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tools_read_authenticated" ON user_tools
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_tools_admin_all" ON user_tools
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "user_forms_read_authenticated" ON user_forms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_forms_admin_all" ON user_forms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
