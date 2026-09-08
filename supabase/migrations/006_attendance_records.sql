-- Migration 006: Control de Asistencia y Jornada Laboral
-- Tabla para registrar entrada, salida, salidas a obra/campo y geolocalización

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_in_location TEXT,
  check_in_is_office BOOLEAN DEFAULT false,
  check_out_time TIMESTAMPTZ,
  check_out_location TEXT,
  check_out_is_office BOOLEAN DEFAULT false,
  total_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'checked_in', -- 'checked_in' | 'field_trip' | 'completed'
  field_trips JSONB DEFAULT '[]'::jsonb, -- [{ id, time, destination, location, notes }]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT attendance_user_date_unique UNIQUE (user_id, date)
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, date DESC);

-- Habilitar RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad RLS
CREATE POLICY "attendance_select_own_or_admin" ON attendance_records
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "attendance_insert_own_or_admin" ON attendance_records
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "attendance_update_own_or_admin" ON attendance_records
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "attendance_delete_admin" ON attendance_records
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_attendance_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

-- Registrar la herramienta en la tabla tools si no existe
INSERT INTO tools (slug, name, category, is_universal)
VALUES ('attendance-tracker', 'Control de Asistencia y Jornada', 'universal', true)
ON CONFLICT (slug) DO NOTHING;
