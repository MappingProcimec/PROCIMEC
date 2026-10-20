import { z } from 'zod';
import { AiPort } from '../../domain/ports/ai.port';
import { AiOptions, AiSchemaValidationError } from '../../domain/models/ai.models';

/**
 * Adaptador Mock para pruebas unitarias y entornos sin conexión o sin clave de API.
 */
export class MockAdapter implements AiPort {
  private mockTextResponse = 'Respuesta simulada generada por MockAdapter.';
  private mockStructuredResponse: unknown = null;

  constructor(mockText?: string, mockStructured?: unknown) {
    if (mockText) this.mockTextResponse = mockText;
    if (mockStructured !== undefined) this.mockStructuredResponse = mockStructured;
  }

  public async generateText(_prompt: string, _options?: AiOptions): Promise<string> {
    return this.mockTextResponse;
  }

  public async generateStructured<T>(
    _prompt: string,
    schema: z.ZodSchema<T>,
    _options?: AiOptions
  ): Promise<T> {
    if (this.mockStructuredResponse !== null) {
      const parseResult = schema.safeParse(this.mockStructuredResponse);
      if (parseResult.success) {
        return parseResult.data;
      }
      throw new AiSchemaValidationError('Mock response does not match schema', parseResult.error.issues);
    }

    // Si no se proporcionó una respuesta simulada estructurada, simula fallo del proveedor de IA
    // para activar el fallback determinista del caso de uso
    throw new AiSchemaValidationError('No mock structured response provided, triggering fallback');
  }
}
