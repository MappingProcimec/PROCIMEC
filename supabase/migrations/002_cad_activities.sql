-- Migration: cad_activities table
-- Run after schema_v2.sql

CREATE TABLE IF NOT EXISTS cad_activities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        REFERENCES projects(id) ON DELETE SET NULL,
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  date         DATE        NOT NULL,
  software     JSONB       NOT NULL DEFAULT '{}',
  phase        TEXT        NOT NULL CHECK (phase IN ('preliminar', 'intermedio', 'final', 'revision')),
  had_rework   BOOLEAN     NOT NULL DEFAULT false,
  rework_notes TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cad_activities_project_id_idx ON cad_activities (project_id);
CREATE INDEX IF NOT EXISTS cad_activities_user_id_idx    ON cad_activities (user_id);
CREATE INDEX IF NOT EXISTS cad_activities_date_idx       ON cad_activities (date DESC);

ALTER TABLE cad_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own cad_activities"
  ON cad_activities FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Users can read own cad_activities"
  ON cad_activities FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Admins can update cad_activities"
  ON cad_activities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

CREATE POLICY "Admins can delete cad_activities"
  ON cad_activities FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));
