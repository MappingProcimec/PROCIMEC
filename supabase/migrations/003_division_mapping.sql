-- Crear división "Mapping" e insertar roles Dibujo y Operador vinculados a ella.
-- Ejecutar en Supabase SQL Editor.

DO $$
DECLARE
  div_id uuid;
  role_dibujo_id uuid;
  role_operador_id uuid;
BEGIN
  -- 1. Insertar división Mapping si no existe
  IF NOT EXISTS (SELECT 1 FROM divisions WHERE name = 'Mapping') THEN
    INSERT INTO divisions (name, description)
    VALUES ('Mapping', 'División principal de la empresa');
  END IF;

  SELECT id INTO div_id FROM divisions WHERE name = 'Mapping' LIMIT 1;

  -- 2. Insertar rol Dibujo si no existe, o actualizar su division_id
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Dibujo') THEN
    INSERT INTO roles (name, division_id, is_system_role)
    VALUES ('Dibujo', div_id, false);
  ELSE
    UPDATE roles SET division_id = div_id WHERE name = 'Dibujo';
  END IF;

  SELECT id INTO role_dibujo_id FROM roles WHERE name = 'Dibujo' LIMIT 1;

  -- 3. Insertar rol Operador si no existe, o actualizar su division_id
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Operador') THEN
    INSERT INTO roles (name, division_id, is_system_role)
    VALUES ('Operador', div_id, false);
  ELSE
    UPDATE roles SET division_id = div_id WHERE name = 'Operador';
  END IF;

  SELECT id INTO role_operador_id FROM roles WHERE name = 'Operador' LIMIT 1;

  RAISE NOTICE 'División Mapping: %', div_id;
  RAISE NOTICE 'Rol Dibujo: %', role_dibujo_id;
  RAISE NOTICE 'Rol Operador: %', role_operador_id;
END $$;
