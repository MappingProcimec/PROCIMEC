-- Crear división "Mapping" e insertar roles Dibujo y Operador vinculados a ella.
-- Ejecutar en Supabase SQL Editor.

DO $$
DECLARE
  div_id uuid;
  role_dibujo_id uuid;
  role_operador_id uuid;
BEGIN
  -- 1. Insertar división Mapping (si no existe)
  INSERT INTO divisions (name, description)
  VALUES ('Mapping', 'División principal de la empresa')
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO div_id FROM divisions WHERE name = 'Mapping' LIMIT 1;

  -- 2. Insertar rol Dibujo vinculado a Mapping (si no existe)
  INSERT INTO roles (name, division_id, is_system_role)
  VALUES ('Dibujo', div_id, false)
  ON CONFLICT (name) DO UPDATE SET division_id = EXCLUDED.division_id;

  SELECT id INTO role_dibujo_id FROM roles WHERE name = 'Dibujo' LIMIT 1;

  -- 3. Insertar rol Operador vinculado a Mapping (si no existe)
  INSERT INTO roles (name, division_id, is_system_role)
  VALUES ('Operador', div_id, false)
  ON CONFLICT (name) DO UPDATE SET division_id = EXCLUDED.division_id;

  SELECT id INTO role_operador_id FROM roles WHERE name = 'Operador' LIMIT 1;

  RAISE NOTICE 'División Mapping: %', div_id;
  RAISE NOTICE 'Rol Dibujo: %', role_dibujo_id;
  RAISE NOTICE 'Rol Operador: %', role_operador_id;
END $$;
