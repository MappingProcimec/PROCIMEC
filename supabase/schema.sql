-- ============================================================
-- PROCIMEC — Supabase Schema
-- Mapping Ingeniería v1.1
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA: users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('admin', 'operator', 'pending', 'dibujo')) DEFAULT 'pending',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  location TEXT NOT NULL,
  contract_number TEXT,
  description TEXT,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: user_projects (asignación operador ↔ proyecto)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_projects (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: field_reports
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  created_by UUID REFERENCES users(id),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_time TIME,

  -- PASO 1: Datos del operativo
  operator_name TEXT,
  gpr_equipment TEXT,
  antenna_frequency TEXT,
  capture_method TEXT,
  positioning_equipment TEXT,
  terrain_conditions TEXT,
  weather_conditions TEXT,

  -- PASO 2: Resumen operativo
  operational_summary JSONB DEFAULT '[]',
  global_max_depth NUMERIC,

  -- PASO 3: Hallazgos
  detected_utilities JSONB DEFAULT '[]',
  anomalies_notes TEXT,
  site_restrictions TEXT,

  -- PASO 4: Notas para CAD
  cad_priority TEXT CHECK (cad_priority IN ('Alta', 'Media', 'Baja')),
  processing_recommendations TEXT,
  filter_gain_notes TEXT,
  additional_notes TEXT,
  elaborated_by TEXT,
  reviewed_by TEXT,

  -- Metadatos Drive
  drive_session_folder_id TEXT,
  drive_session_folder_url TEXT,
  docx_drive_file_id TEXT,
  docx_drive_url TEXT,

  status TEXT CHECK (status IN ('draft', 'submitted', 'reviewed')) DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: report_files
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_report_id UUID REFERENCES field_reports(id) ON DELETE CASCADE,
  file_type TEXT CHECK (file_type IN ('raw_gpr', 'gps', 'photo')),
  original_name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_webview_url TEXT,
  drive_download_url TEXT,
  caption TEXT,
  size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_field_reports_project ON field_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_field_reports_created_by ON field_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_field_reports_date ON field_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_report_files_report ON report_files(field_report_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project ON user_projects(project_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_files ENABLE ROW LEVEL SECURITY;

-- Users: cada uno ve su propio perfil; admin ve todos
CREATE POLICY "users_self_or_admin" ON users
  FOR ALL USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Projects: operators ven solo los asignados; admin ve todos
CREATE POLICY "projects_operator_assigned_or_admin" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.project_id = projects.id AND up.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "projects_admin_write" ON projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- User_projects: admin gestiona asignaciones; operators ven las suyas
CREATE POLICY "user_projects_access" ON user_projects
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "user_projects_admin_write" ON user_projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Field reports: operators ven/crean los suyos; admin ve todos
CREATE POLICY "field_reports_own_or_admin" ON field_reports
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "field_reports_operator_insert" ON field_reports
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "field_reports_operator_update_own" ON field_reports
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "field_reports_admin_delete" ON field_reports
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Report files: misma lógica que field_reports
CREATE POLICY "report_files_own_or_admin" ON report_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM field_reports fr
      WHERE fr.id = report_files.field_report_id
      AND (
        fr.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );

CREATE POLICY "report_files_insert" ON report_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM field_reports fr
      WHERE fr.id = report_files.field_report_id AND fr.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN: updated_at automático
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER field_reports_updated_at
  BEFORE UPDATE ON field_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLA: drawing_activities (rol dibujo)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drawing_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  project_name TEXT NOT NULL,
  activity_date DATE NOT NULL,
  responsible TEXT NOT NULL,
  software TEXT NOT NULL CHECK (software IN ('CIVIL 3D', 'REVIT', 'OTRO')),
  elaboration_stage TEXT CHECK (elaboration_stage IN ('INICIO', 'PROCESO', 'FINAL')),
  other_software_name TEXT,
  hours_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_rework BOOLEAN NOT NULL DEFAULT FALSE,
  rework_observations TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS para drawing_activities
ALTER TABLE drawing_activities ENABLE ROW LEVEL SECURITY;

-- Usuarios con rol 'dibujo' solo ven sus propios registros
CREATE POLICY "dibujo_select_own" ON drawing_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "dibujo_insert_own" ON drawing_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin ve todo
CREATE POLICY "admin_all_drawing" ON drawing_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
