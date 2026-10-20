import { z } from 'zod';

export const AffectedFilePlanSchema = z.object({
  path: z.string().min(1, 'La ruta del archivo es obligatoria'),
  action: z.enum(['modify', 'create', 'delete']),
  reason: z.string().min(1, 'El motivo de la modificación es obligatorio'),
});

export const ExternalActionSchema = z.object({
  type: z.enum(['supabase_sql', 'env_var', 'manual_permission']),
  title: z.string().min(1),
  instructions: z.string().min(1),
  payload: z.string().optional(),
});

export const TechnicalSpecSchema = z.object({
  summary: z.string().min(5, 'El resumen del plan debe ser descriptivo'),
  affectedFiles: z.array(AffectedFilePlanSchema).min(1, 'Debe especificarse al menos un archivo afectado'),
  risks: z.array(z.string()).default([]),
  verificationCommands: z.array(z.string()).default(['npx tsc --noEmit', 'npm run build']),
  estimatedComplexity: z.enum(['low', 'medium', 'high']).default('low'),
  externalActions: z.array(ExternalActionSchema).default([]),
});

export const CreateTicketSchema = z.object({
  title: z.string().min(4, 'El título debe tener al menos 4 caracteres').max(150, 'El título no debe superar 150 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  contextUrl: z.string().optional().nullable(),
});

export const UpdateTicketStatusSchema = z.object({
  status: z.enum([
    'pending_spec',
    'awaiting_approval',
    'approved',
    'in_progress',
    'verifying',
    'completed',
    'failed',
    'cancelled',
  ]),
  feedback: z.string().optional(),
  commitHash: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const ReformulateTicketSchema = z.object({
  feedback: z.string().min(3, 'Las instrucciones de ajuste deben tener al menos 3 caracteres'),
});
