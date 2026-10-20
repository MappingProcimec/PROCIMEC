/**
 * Modelos de Dominio para el Subsistema de Inteligencia Artificial.
 */

export interface AiOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemInstruction?: string;
  preferredModel?: string;
}

export class AiProviderError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;

  constructor(message: string, code = 'AI_PROVIDER_ERROR', statusCode?: number, isRetryable = true) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class AiSchemaValidationError extends Error {
  public readonly issues: unknown[];

  constructor(message: string, issues: unknown[] = []) {
    super(message);
    this.name = 'AiSchemaValidationError';
    this.issues = issues;
  }
}

export interface FieldExtractionInput {
  rawText: string;
  projectId?: string;
  operatorName?: string;
}

export interface HseqAuditInput {
  formTitle: string;
  formCode?: string;
  formData: Record<string, unknown>;
  observations?: string;
}
