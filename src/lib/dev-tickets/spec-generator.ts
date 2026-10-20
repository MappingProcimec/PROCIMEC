import { GeminiAdapter } from '@/core/ai/infrastructure/adapters/gemini.adapter';
import { TechnicalSpecSchema } from './schemas';
import { TechnicalSpec, FeedbackEntry } from './types';

export async function generateDevTicketSpec(params: {
  title: string;
  description: string;
  contextUrl?: string | null;
  feedbackHistory?: FeedbackEntry[];
}): Promise<TechnicalSpec> {
  const gemini = new GeminiAdapter();

  const systemInstruction = `Eres el Arquitecto de Software Principal de PROCIMEC (PCM CLOUD), una plataforma empresarial Next.js 14 con Supabase PostgreSQL y TypeScript.
Debes analizar tickets de desarrollo y generar planes de ingeniería rigurosos siguiendo la Constitución de Desarrollo (AGENTS.md):
- Ley 1: Compilación limpia sin errores TypeScript (npx tsc --noEmit).
- Ley 2: Persistencia relacional en Supabase con integridad referencial.
- Ley 4: Hub centralizado en /dashboard, herramientas en /tools/[slug].
- Ley 5: Paleta oficial Carbón (#1E2229), Ámbar (#EAA023), contraste WCAG AAA (prohibido text-white sobre ámbar), cero emojis.
- Ley 7: Frontend 100% en español, backend e identificadores en inglés.

Si el requerimiento necesita cambios en la base de datos (nuevas tablas, columnas, RLS) o variables de entorno, especifícalo OBLIGATORIAMENTE en 'externalActions':
- type: 'supabase_sql' | 'env_var' | 'manual_permission'
- title: Título de la acción
- instructions: Instrucción clara para el Administrador
- payload: Bloque SQL exacto e idempotente (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

Tu salida debe ser un objeto JSON estrictamente validable bajo TechnicalSpecSchema con:
- summary: Breve síntesis técnica del cambio en español.
- affectedFiles: Lista de archivos a crear, modificar o eliminar con motivo específico.
- risks: Principales riesgos o posibles regresiones a cuidar.
- verificationCommands: Comandos para validar (por defecto 'npx tsc --noEmit', 'npm run build').
- estimatedComplexity: 'low' | 'medium' | 'high'.
- externalActions: Lista de acciones requeridas previas en Supabase o entorno (vacío si es solo código).`;

  let prompt = `REQUERIMIENTO DEL TICKET:
Título: ${params.title}
Descripción: ${params.description}
URL de Contexto: ${params.contextUrl || 'No especificada'}
`;

  if (params.feedbackHistory && params.feedbackHistory.length > 0) {
    prompt += `\nHISTORIAL DE OBSERVACIONES Y REFORMULACIÓN DEL ADMINISTRADOR:\n`;
    params.feedbackHistory.forEach((fb) => {
      prompt += `[Iteración ${fb.version} - ${fb.author}]: ${fb.message}\n`;
    });
    prompt += `\nINSTRUCCIÓN ADICIONAL: Ajusta el plan técnico para cumplir estrictamente con las observaciones indicadas por el administrador.`;
  }

  try {
    const spec = await gemini.generateStructured<TechnicalSpec>(
      prompt,
      TechnicalSpecSchema,
      {
        systemInstruction,
        temperature: 0.2,
        maxTokens: 1200,
      }
    );
    return spec;
  } catch (error) {
    console.error('[generateDevTicketSpec] Error generando especificación:', error);
    // Fallback defensivo determinista
    return {
      summary: `Implementación técnica para: ${params.title}`,
      affectedFiles: [
        {
          path: params.contextUrl ? `app${params.contextUrl}/page.tsx` : 'app/dashboard/page.tsx',
          action: 'modify',
          reason: 'Ajuste inicial según requerimiento reportado',
        },
      ],
      risks: ['Revisar consistencia de tipos y contratos en el componente.'],
      verificationCommands: ['npx tsc --noEmit', 'npm run build'],
      estimatedComplexity: 'low',
    };
  }
}
