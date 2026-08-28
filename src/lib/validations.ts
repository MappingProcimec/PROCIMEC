import { z } from 'zod';

export const operationalRowSchema = z.object({
  id: z.string(),
  sector: z.string().min(1, 'El tramo/sector es requerido'),
  ml: z.union([z.number(), z.literal('')]),
  m2: z.union([z.number(), z.literal('')]),
  max_depth_m: z.union([z.number(), z.literal('')]),
  observations: z.string(),
});

export const detectedUtilitySchema = z.object({
  id: z.string(),
  type: z.string(),
  estimated_depth_m: z.union([z.number(), z.literal('')]),
  confidence: z.enum(['Alta', 'Media', 'Baja', '']),
  description: z.string(),
});

export const section1Schema = z.object({
  report_date: z.string().min(1, 'La fecha es requerida'),
  report_time: z.string().min(1, 'La hora de inicio es requerida'),
  report_end_time: z.string().optional(),
  operator_name: z.string().min(1, 'El nombre del operador es requerido'),
  equipments_used: z.array(z.string()).min(1, 'Selecciona al menos un equipo utilizado'),
  positioning_equipment: z.string().min(1, 'El equipo de posicionamiento es requerido'),
  terrain_conditions: z.string().min(1, 'El tipo de terreno es requerido'),
  weather_conditions: z.string().optional(),
  capture_method: z.string().min(1, 'El método de captura es requerido'),
});

export const section2Schema = z.object({
  antenna_frequency: z.string().optional(),
  rdp_value: z.string().optional(),
  filter_gain_notes: z.string().optional(),
  scans_per_meter: z.string().optional(),
  rd_data_notes: z.string().optional(),
  anomalies_notes: z.string().optional(),
  site_restrictions: z.string().optional(),
  cad_priority: z.enum(['Alta', 'Media', 'Baja'], {
    message: 'La prioridad de digitalización es requerida',
  }),
  processing_recommendations: z.string().optional(),
});

export const createProjectSchema = z.object({
  cost_center: z.string().optional(),
  code: z.string().optional(),
  name: z.string().min(1, 'El nombre del proyecto es requerido'),
  client: z.string().min(1, 'El cliente es requerido'),
  location: z.string().min(1, 'La ubicación es requerida'),
  contract_number: z.string().optional(),
  description: z.string().optional(),
}).transform((data) => ({
  ...data,
  cost_center: (data.cost_center || data.code || '').trim(),
})).refine((data) => data.cost_center.length > 0, {
  message: 'El centro de costo es requerido',
  path: ['cost_center'],
});

export type Section1Input = z.infer<typeof section1Schema>;
export type Section2Input = z.infer<typeof section2Schema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
