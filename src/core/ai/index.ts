// Domain Ports & Models
export type { AiPort } from './domain/ports/ai.port';
export {
  AiProviderError,
  AiSchemaValidationError,
  type AiOptions,
  type FieldExtractionInput,
  type HseqAuditInput,
} from './domain/models/ai.models';

// Infrastructure Adapters & Schemas
export { GeminiAdapter } from './infrastructure/adapters/gemini.adapter';
export { MockAdapter } from './infrastructure/adapters/mock.adapter';
export {
  fieldExtractionSchema,
  hseqAuditSchema,
  gprSummaryOutputSchema,
  type FieldExtractionData,
  type HseqAuditData,
  type GprSummaryOutput,
} from './infrastructure/schemas/ai.schemas';

// Application Use Cases
export {
  ExtractFieldDataUseCase,
  type ExtractFieldDataCommand,
} from './application/use-cases/extract-field-data.use-case';
export {
  AuditHseqComplianceUseCase,
  type AuditHseqCommand,
} from './application/use-cases/audit-hseq-compliance.use-case';
export {
  GenerateGprSummaryUseCase,
  buildDeterministicSummary,
  formatDiameter,
  parseProjectDescriptionAndTargets,
  type ProjectContext,
  type GprReportContext,
} from './application/use-cases/generate-gpr-summary.use-case';

// Fábrica Singleton de conveniencia para la aplicación
import { GeminiAdapter } from './infrastructure/adapters/gemini.adapter';
import { ExtractFieldDataUseCase } from './application/use-cases/extract-field-data.use-case';
import { AuditHseqComplianceUseCase } from './application/use-cases/audit-hseq-compliance.use-case';
import { GenerateGprSummaryUseCase } from './application/use-cases/generate-gpr-summary.use-case';

const defaultGeminiAdapter = new GeminiAdapter();

export const extractFieldDataUseCase = new ExtractFieldDataUseCase(defaultGeminiAdapter);
export const auditHseqComplianceUseCase = new AuditHseqComplianceUseCase(defaultGeminiAdapter);
export const generateGprSummaryUseCase = new GenerateGprSummaryUseCase(defaultGeminiAdapter);
