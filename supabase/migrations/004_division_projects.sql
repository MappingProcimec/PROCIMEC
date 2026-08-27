-- ============================================================
-- PROCIMEC — Migración 004: Vinculación directa División ↔ Proyecto
-- Relación many-to-many: una división puede tener múltiples proyectos
-- y un proyecto puede pertenecer a múltiples divisiones.
-- ============================================================

CREATE TABLE IF NOT EXISTS division_projects (
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id)  ON DELETE CASCADE,
  PRIMARY KEY (division_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_division_projects_division ON division_projects(division_id);
CREATE INDEX IF NOT EXISTS idx_division_projects_project  ON division_projects(project_id);
