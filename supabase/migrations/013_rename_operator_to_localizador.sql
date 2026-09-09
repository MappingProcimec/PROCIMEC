-- ==============================================================================
-- Migración 013: Renombrar rol 'Operador' a 'Localizador'
-- y actualizar etiqueta en catálogo de formularios.
-- ==============================================================================

-- 1. Actualizar el nombre del rol en la tabla roles
UPDATE roles
SET name = 'Localizador'
WHERE name = 'Operador';

-- 2. Actualizar la etiqueta del campo operator_name en el schema del formulario GPR
UPDATE forms
SET schema = jsonb_set(
  schema,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN field->>'key' = 'operator_name' 
        THEN jsonb_set(field, '{label}', '"Localizador responsable"')
        ELSE field 
      END
    )
    FROM jsonb_array_elements(schema->'fields') AS field
  )
)
WHERE slug = 'gpr-field-form';

-- 3. (Opcional) Si se desea actualizar el constraint histórico de la tabla users:
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator', 'pending', 'dibujo', 'localizador'));
