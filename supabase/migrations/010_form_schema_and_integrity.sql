-- ==============================================================================
-- MIGRACIÓN 010: ARQUITECTURA DE ESQUEMAS DE FORMULARIOS Y REGLAS DE INTEGRIDAD
-- Plataforma PROCIMEC — Schema-Driven Architecture
-- ==============================================================================

-- 1. Agregar columna `schema` a la tabla `forms` si no existe
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS schema JSONB DEFAULT '{}';

-- 2. Registrar el Esquema Canónico para Formulario de Registro CAD/BIM (nueva-actividad)
UPDATE forms
SET schema = '{
  "slug": "nueva-actividad",
  "name": "Formulario de Registro CAD/BIM",
  "target_table": "drawing_activities",
  "rules": {
    "require_active_project": true,
    "project_match_field": "name",
    "responsible_type": "USER_EMAIL",
    "defaults": {
      "hours_worked": 8.5,
      "activity_date": "CURRENT_DATE",
      "elaboration_stage": "PROCESO",
      "is_rework": false,
      "software": "CIVIL 3D"
    }
  },
  "fields": [
    {
      "key": "project_name",
      "label": "Proyecto Asignado",
      "type": "project_select",
      "required": true,
      "description": "Proyecto activo asignado al colaborador"
    },
    {
      "key": "activity_date",
      "label": "Fecha de la actividad",
      "type": "date",
      "required": true,
      "default": "CURRENT_DATE"
    },
    {
      "key": "software",
      "label": "Software utilizado",
      "type": "select",
      "options": ["CIVIL 3D", "REVIT", "OTRO"],
      "required": true
    },
    {
      "key": "hours_worked",
      "label": "Horas trabajadas",
      "type": "number",
      "required": true,
      "default": 8.5
    },
    {
      "key": "elaboration_stage",
      "label": "Etapa de elaboración",
      "type": "select",
      "options": ["INICIO", "PROCESO", "FINAL"],
      "required": false,
      "default": "PROCESO"
    },
    {
      "key": "is_rework",
      "label": "¿Hubo reproceso?",
      "type": "boolean",
      "required": true,
      "default": false
    },
    {
      "key": "rework_observations",
      "label": "Motivo del reproceso",
      "type": "text",
      "required_if": { "field": "is_rework", "value": true }
    }
  ]
}'::jsonb
WHERE slug = 'nueva-actividad' OR slug = 'cad-register-form';

-- 3. Registrar el Esquema Canónico para Formulario de Campo GPR (gpr-field-form)
UPDATE forms
SET schema = '{
  "slug": "gpr-field-form",
  "name": "Formulario de Campo GPR",
  "target_table": "field_reports",
  "rules": {
    "require_active_project": true,
    "project_match_field": "id",
    "responsible_type": "USER_ID",
    "defaults": {
      "cad_priority": "Media",
      "capture_method": "Rueda odómetro",
      "weather_conditions": "Despejado",
      "gpr_equipment": "GPR ProEx",
      "antenna_frequency": "400 MHz",
      "status": "submitted"
    }
  },
  "fields": [
    {
      "key": "project_id",
      "label": "Proyecto",
      "type": "project_select",
      "required": true
    },
    {
      "key": "report_date",
      "label": "Fecha de inspección",
      "type": "date",
      "required": true,
      "default": "CURRENT_DATE"
    },
    {
      "key": "operator_name",
      "label": "Operador responsable",
      "type": "text",
      "required": true,
      "default": "USER_NAME"
    },
    {
      "key": "gpr_equipment",
      "label": "Equipo GPR",
      "type": "text",
      "required": true,
      "default": "GPR ProEx"
    },
    {
      "key": "antenna_frequency",
      "label": "Frecuencia de antena",
      "type": "text",
      "required": false,
      "default": "400 MHz"
    },
    {
      "key": "terrain_conditions",
      "label": "Condiciones del terreno",
      "type": "text",
      "required": false,
      "default": "Asfalto / Mixto"
    },
    {
      "key": "weather_conditions",
      "label": "Condiciones climáticas",
      "type": "text",
      "required": false,
      "default": "Despejado"
    },
    {
      "key": "capture_method",
      "label": "Método de captura",
      "type": "select",
      "options": ["Rueda odómetro", "GPS cinemático", "Marcas de tiempo / Estación total"],
      "required": false,
      "default": "Rueda odómetro"
    },
    {
      "key": "cad_priority",
      "label": "Prioridad CAD",
      "type": "select",
      "options": ["Alta", "Media", "Baja"],
      "required": true,
      "default": "Media"
    },
    {
      "key": "additional_notes",
      "label": "Observaciones y anomalías",
      "type": "text",
      "required": false
    }
  ]
}'::jsonb
WHERE slug = 'gpr-field-form';

-- 4. Restricciones Duras de Integridad en Tablas Existentes

-- Reglas para drawing_activities
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drawing_software') THEN
    ALTER TABLE drawing_activities 
      ADD CONSTRAINT chk_drawing_software 
      CHECK (software IN ('CIVIL 3D', 'REVIT', 'OTRO'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drawing_hours') THEN
    ALTER TABLE drawing_activities 
      ADD CONSTRAINT chk_drawing_hours 
      CHECK (hours_worked > 0 AND hours_worked <= 24);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drawing_stage') THEN
    ALTER TABLE drawing_activities 
      ADD CONSTRAINT chk_drawing_stage 
      CHECK (elaboration_stage IN ('INICIO', 'PROCESO', 'FINAL'));
  END IF;
END $$;

ALTER TABLE drawing_activities 
  ALTER COLUMN hours_worked SET DEFAULT 8.5;

-- Reglas para field_reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_field_reports_priority') THEN
    ALTER TABLE field_reports 
      ADD CONSTRAINT chk_field_reports_priority 
      CHECK (cad_priority IN ('Alta', 'Media', 'Baja'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_field_reports_status') THEN
    ALTER TABLE field_reports 
      ADD CONSTRAINT chk_field_reports_status 
      CHECK (status IN ('draft', 'submitted', 'reviewed'));
  END IF;
END $$;

ALTER TABLE field_reports 
  ALTER COLUMN report_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN status SET DEFAULT 'submitted',
  ALTER COLUMN cad_priority SET DEFAULT 'Media';
