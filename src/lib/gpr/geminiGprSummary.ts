/**
 * Fachada de compatibilidad para síntesis de Georadar (GPR).
 * Reenvía al caso de uso desacoplado en `src/core/ai` (Arquitectura Hexagonal - Gentleman Programming).
 * Mantiene intactas las firmas para evitar roturas en consumidores existentes y suites de test.
 */

import {
  generateGprSummaryUseCase,
  formatDiameter,
  parseProjectDescriptionAndTargets,
  type ProjectContext,
  type GprReportContext,
} from '@/core/ai';

export {
  formatDiameter,
  parseProjectDescriptionAndTargets,
  type ProjectContext,
  type GprReportContext,
};

/**
 * Consulta la IA o el generador determinista para sintetizar un párrafo técnico ejecutivo del día.
 */
export async function generateGprExecutiveSummary(
  project: ProjectContext,
  report: GprReportContext
): Promise<string> {
  return generateGprSummaryUseCase.execute(project, report);
}
