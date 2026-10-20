import { z } from 'zod';

/**
 * Esquema Zod para extracción de notas de campo (Voz / Texto).
 * Parsea información operativa dictada o escrita por cuadrillas de geofísica y topografía.
 */
export const fieldExtractionSchema = z.object({
  summary: z.string().describe('Resumen ejecutivo de la jornada o nota de campo'),
  metrics: z.object({
    linear_meters: z.number().nullable().optional().describe('Metros lineales explorados (ML)'),
    square_meters: z.number().nullable().optional().describe('Área explorada en metros cuadrados (m2)'),
    max_depth_m: z.number().nullable().optional().describe('Profundidad máxima alcanzada en metros'),
  }),
  equipment: z.array(z.string()).default([]).describe('Equipos mencionados (GPR, GPS, Georadar, etc.)'),
  detected_utilities: z.array(
    z.object({
      type: z.string().describe('Tipo de servicio (Gas, Agua, Eléctrico, Telecomunicaciones, Alcantarillado, etc.)'),
      diameter: z.string().optional().describe('Diámetro de tubería si fue mencionado (ej: 4", 100mm)'),
      estimated_depth_m: z.union([z.number(), z.string()]).optional().describe('Profundidad estimada en metros'),
      confidence: z.enum(['Alta', 'Media', 'Baja', '']).default('Media').describe('Nivel de certidumbre del hallazgo'),
      notes: z.string().optional().describe('Notas adicionales del alineamiento o anomalía'),
    })
  ).default([]),
  terrain_conditions: z.string().optional().describe('Condiciones del terreno (Asfalto, Concreto, Tierra, etc.)'),
  weather_conditions: z.string().optional().describe('Clima observado (Soleado, Nublado, Lluvioso, etc.)'),
  anomalies_or_notes: z.string().optional().describe('Anomalías, restricciones o incidentes reportados'),
  confidence_score: z.number().min(0).max(100).default(90).describe('Puntaje de confianza en la extracción'),
});

export type FieldExtractionData = z.infer<typeof fieldExtractionSchema>;

/**
 * Esquema Zod para auditoría pre-vuelo HSEQ y calidad documental.
 * Evalúa cumplimiento previo a la firma digital según las leyes de PROCIMEC.
 */
export const hseqAuditSchema = z.object({
  is_compliant: z.boolean().describe('Indica si el formato cumple los requerimientos mínimos de calidad y seguridad'),
  compliance_score: z.number().min(0).max(100).describe('Puntuación de 0 a 100 del estado del formato'),
  overall_assessment: z.string().describe('Concepto técnico conciso del aseguramiento HSEQ'),
  critical_risks: z.array(z.string()).default([]).describe('Riesgos no mitigados o discrepancias críticas'),
  missing_requirements: z.array(z.string()).default([]).describe('Campos o evidencias faltantes antes de firmar'),
  preventive_recommendations: z.array(z.string()).default([]).describe('Recomendaciones operativas preventivas'),
  approved_for_signature: z.boolean().describe('Bandera final que autoriza o previene la firma legal'),
});

export type HseqAuditData = z.infer<typeof hseqAuditSchema>;

/**
 * Esquema Zod para síntesis ejecutiva de Georadar (GPR).
 */
export const gprSummaryOutputSchema = z.object({
  executive_summary: z.string().describe('Párrafo técnico formal de 80 a 140 palabras para la interventoría'),
  cad_priority: z.enum(['ALTA', 'MEDIA', 'BAJA', 'URGENTE']).default('MEDIA'),
  key_highlights: z.array(z.string()).default([]),
});

export type GprSummaryOutput = z.infer<typeof gprSummaryOutputSchema>;
