/**
 * ==============================================================================
 * PROCIMEC — Catálogo Canónico de Esquemas de Formularios (Schema-Driven)
 * Fuente única de verdad para la Web y el Agente de WhatsApp
 * ==============================================================================
 */

export interface FormRuleConfig {
  requireActiveProject: boolean;
  responsibleFieldType: 'USER_EMAIL' | 'USER_ID' | 'USER_NAME';
  targetTable: string;
  defaults: Record<string, unknown>;
}

export interface CanonicalFormField {
  key: string;
  label: string;
  type: 'project_select' | 'select' | 'text' | 'number' | 'date' | 'boolean' | 'textarea';
  required: boolean;
  options?: string[];
  default?: unknown;
  description?: string;
  requiredIf?: { field: string; value: unknown };
}

export interface CanonicalFormDefinition {
  slug: string;
  name: string;
  targetTable: string;
  description: string;
  rules: FormRuleConfig;
  fields: CanonicalFormField[];
}

/**
 * Catálogo Canónico de Formularios Oficiales de PROCIMEC
 */
export const PROCIMEC_FORM_CATALOG: Record<string, CanonicalFormDefinition> = {
  'nueva-actividad': {
    slug: 'nueva-actividad',
    name: 'Formulario de Registro CAD/BIM',
    targetTable: 'drawing_activities',
    description: 'Registra actividades diarias de modelado y dibujo CAD/BIM.',
    rules: {
      requireActiveProject: true,
      responsibleFieldType: 'USER_EMAIL',
      targetTable: 'drawing_activities',
      defaults: {
        hours_worked: 8.5,
        activity_date: 'CURRENT_DATE',
        elaboration_stage: 'PROCESO',
        is_rework: false,
        software: 'CIVIL 3D',
      },
    },
    fields: [
      {
        key: 'project_name',
        label: 'Proyecto Asignado',
        type: 'project_select',
        required: true,
        description: 'Proyecto activo asignado al colaborador',
      },
      {
        key: 'activity_date',
        label: 'Fecha de la actividad',
        type: 'date',
        required: true,
        default: 'CURRENT_DATE',
      },
      {
        key: 'software',
        label: 'Software utilizado',
        type: 'select',
        options: ['CIVIL 3D', 'REVIT', 'OTRO'],
        required: true,
      },
      {
        key: 'hours_worked',
        label: 'Horas trabajadas',
        type: 'number',
        required: true,
        default: 8.5,
      },
      {
        key: 'elaboration_stage',
        label: 'Etapa de elaboración',
        type: 'select',
        options: ['INICIO', 'PROCESO', 'FINAL'],
        required: false,
        default: 'PROCESO',
      },
      {
        key: 'is_rework',
        label: '¿Hubo reproceso?',
        type: 'boolean',
        required: true,
        default: false,
      },
      {
        key: 'rework_observations',
        label: 'Motivo del reproceso',
        type: 'text',
        required: false,
        requiredIf: { field: 'is_rework', value: true },
      },
    ],
  },

  'gpr-field-form': {
    slug: 'gpr-field-form',
    name: 'Formulario de Campo GPR',
    targetTable: 'field_reports',
    description: 'Reporte operacional de exploración geofísica y medición con Georradar.',
    rules: {
      requireActiveProject: true,
      responsibleFieldType: 'USER_ID',
      targetTable: 'field_reports',
      defaults: {
        cad_priority: 'Media',
        capture_method: 'Rueda odómetro',
        weather_conditions: 'Despejado',
        gpr_equipment: 'GPR ProEx',
        antenna_frequency: '400 MHz',
        report_date: 'CURRENT_DATE',
        status: 'submitted',
      },
    },
    fields: [
      {
        key: 'project_id',
        label: 'Proyecto',
        type: 'project_select',
        required: true,
      },
      {
        key: 'report_date',
        label: 'Fecha de inspección',
        type: 'date',
        required: true,
        default: 'CURRENT_DATE',
      },
      {
        key: 'operator_name',
        label: 'Operador responsable',
        type: 'text',
        required: true,
      },
      {
        key: 'gpr_equipment',
        label: 'Equipo GPR',
        type: 'text',
        required: true,
        default: 'GPR ProEx',
      },
      {
        key: 'antenna_frequency',
        label: 'Frecuencia de antena',
        type: 'text',
        required: false,
        default: '400 MHz',
      },
      {
        key: 'terrain_conditions',
        label: 'Condiciones del terreno',
        type: 'text',
        required: false,
        default: 'Asfalto / Mixto',
      },
      {
        key: 'weather_conditions',
        label: 'Condiciones climáticas',
        type: 'text',
        required: false,
        default: 'Despejado',
      },
      {
        key: 'capture_method',
        label: 'Método de captura',
        type: 'select',
        options: ['Rueda odómetro', 'GPS cinemático', 'Marcas de tiempo / Estación total'],
        required: false,
        default: 'Rueda odómetro',
      },
      {
        key: 'cad_priority',
        label: 'Prioridad CAD',
        type: 'select',
        options: ['Alta', 'Media', 'Baja'],
        required: true,
        default: 'Media',
      },
      {
        key: 'additional_notes',
        label: 'Observaciones y anomalías',
        type: 'text',
        required: false,
      },
    ],
  },
};

// Aliases
PROCIMEC_FORM_CATALOG['cad-register-form'] = PROCIMEC_FORM_CATALOG['nueva-actividad'];
PROCIMEC_FORM_CATALOG['cad-register'] = PROCIMEC_FORM_CATALOG['nueva-actividad'];
PROCIMEC_FORM_CATALOG['gpr-report'] = PROCIMEC_FORM_CATALOG['gpr-field-form'];
