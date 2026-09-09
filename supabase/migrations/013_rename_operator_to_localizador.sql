-- ==============================================================================
-- Migración 013: Renombrar rol 'Operador' a 'Localizador', 
-- columna operator_name a localizador_name y actualizar esquema de formularios.
-- ==============================================================================

-- 1. Renombrar rol en la tabla roles
UPDATE roles
SET name = 'Localizador'
WHERE name = 'Operador';

-- 2. Renombrar columna en la tabla de reportes
ALTER TABLE field_reports 
RENAME COLUMN operator_name TO localizador_name;

-- 3. Actualizar el constraint de roles de usuario
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'localizador', 'operator', 'pending', 'dibujo'));

-- 4. Migrar los usuarios existentes con rol 'operator' a 'localizador'
UPDATE users SET role = 'localizador' WHERE role = 'operator';

-- 5. Actualizar la clave y etiqueta en el JSON del formulario de campo GPR
UPDATE forms
SET schema = jsonb_set(
  schema,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN field->>'key' = 'operator_name' 
        THEN jsonb_set(
          jsonb_set(field, '{key}', '"localizador_name"'),
          '{label}',
          '"Localizador responsable"'
        )
        ELSE field 
      END
    )
    FROM jsonb_array_elements(schema->'fields') AS field
  )
)
WHERE slug = 'gpr-field-form';
