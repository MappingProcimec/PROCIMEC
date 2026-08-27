-- Permite que un usuario pertenezca a múltiples divisiones con un rol por división
CREATE TABLE IF NOT EXISTS user_division_roles (
  user_id     UUID REFERENCES users(id)     ON DELETE CASCADE,
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE,
  role_id     UUID REFERENCES roles(id)     ON DELETE SET NULL,
  PRIMARY KEY (user_id, division_id)
);

CREATE INDEX IF NOT EXISTS idx_udr_user     ON user_division_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_udr_division ON user_division_roles(division_id);
