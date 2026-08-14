import { z } from 'zod';

export const operationalRowSchema = z.object({
  id: z.string(),
  sector: z.string().min(1, 'El sector es requerido'),
  ml: z.union([z.number().min(0), z.literal('')]),
  m2: z.union([z.number().min(0), z.literal('')]),
  max_depth_m: z.union([z.number().min(0), z.literal('')]),
  surface_type: z.string(),
  observations: z.string(),
});

export const step1Schema = z.object({
  report_date: z.string().min(1, 'La fecha es requerida'),
  report_time: z.string().min(1, 'La hora de inicio es requerida'),
  operator_name: z.string().min(1, 'El nombre del operador es requerido'),
  gpr_equipment: z.string().min(1, 'El equipo GPR es requerido'),
  antenna_frequency: z.string().min(1, 'La frecuencia de antena es requerida'),
  capture_method: z.string().min(1, 'El método de captura es requerido'),
  positioning_equipment: z.string().min(1, 'El equipo de posicionamiento es requerido'),
  terrain_conditions: z.string().min(1, 'Las condiciones de terreno son requeridas'),
  weather_conditions: z.string().optional(),
});

export const step2Schema = z.object({
  operational_summary: z
    .array(operationalRowSchema)
    .min(1, 'Agrega al menos una fila de resumen operativo'),
  global_max_depth: z.union([z.number().min(0), z.literal('')]),
});

export const detectedUtilitySchema = z.object({
  id: z.string(),
  type: z.string(),
  estimated_depth_m: z.union([z.number().min(0), z.literal('')]),
  confidence: z.enum(['Alta', 'Media', 'Baja', '']),
  description: z.string(),
});

export const step3Schema = z.object({
  detected_utilities: z.array(detectedUtilitySchema),
  anomalies_notes: z.string(),
  site_restrictions: z.string(),
});

export const step4Schema = z.object({
  cad_priority: z.enum(['Alta', 'Media', 'Baja'], {
    message: 'La prioridad de digitalización es requerida',
  }),
  processing_recommendations: z.string(),
  filter_gain_notes: z.string(),
  additional_notes: z.string(),
  elaborated_by: z.string().min(1, 'El campo "Elaborado por" es requerido'),
  reviewed_by: z.string(),
});

export const createProjectSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(30),
  name: z.string().min(1, 'El nombre es requerido'),
  client: z.string().min(1, 'El cliente es requerido'),
  location: z.string().min(1, 'La ubicación es requerida'),
  contract_number: z.string().optional(),
  description: z.string().optional(),
});

export type Step1Input = z.infer<typeof step1Schema>;
export type Step2Input = z.infer<typeof step2Schema>;
export type Step3Input = z.infer<typeof step3Schema>;
export type Step4Input = z.infer<typeof step4Schema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
