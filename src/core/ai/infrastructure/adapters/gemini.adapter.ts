import { z } from 'zod';
import { AiPort } from '../../domain/ports/ai.port';
import { AiOptions, AiProviderError, AiSchemaValidationError } from '../../domain/models/ai.models';

/**
 * Adaptador de Infraestructura para Google Gemini AI.
 * Implementa el puerto AiPort aplicando los principios de Gentleman Programming:
 * - Desacoplamiento de la lógica de negocio.
 * - Validación rigurosa de Structured Outputs con Zod.
 * - Soporte para modelos gratuitos y resiliencia multi-modelo con timeout estricto.
 */
export class GeminiAdapter implements AiPort {
  private readonly apiKey: string | undefined;
  private readonly defaultModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
  ];

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  public async generateText(prompt: string, options: AiOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new AiProviderError('GEMINI_API_KEY no está configurada en las variables de entorno', 'API_KEY_MISSING', 500, false);
    }

    const modelsToTry = options.preferredModel ? [options.preferredModel, ...this.defaultModels] : this.defaultModels;
    const timeoutMs = options.timeoutMs ?? 9000;
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const body: Record<string, unknown> = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 500,
          },
        };

        if (options.systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
          };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return text;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn(`[GeminiAdapter] Advertencia con modelo ${model}: HTTP ${res.status}`, errData);
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[GeminiAdapter] Excepción llamando a ${model}:`, lastError.message);
      }
    }

    throw new AiProviderError(
      `No se pudo obtener respuesta de ningún modelo de Gemini disponible. Causa: ${lastError?.message || 'Timeout o fallo de red'}`,
      'ALL_MODELS_FAILED',
      503
    );
  }

  public async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: AiOptions = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new AiProviderError('GEMINI_API_KEY no está configurada', 'API_KEY_MISSING', 500, false);
    }

    // Inyectamos directiva de schema y formato JSON estricto
    const structuredPrompt = `${prompt}

INSTRUCCIÓN DE ESTRUCTURA Y FORMATO OBLIGATORIO:
Debes responder EXCLUSIVAMENTE con un objeto JSON válido que cumpla estrictamente con la estructura solicitada.
NO incluyas bloques de formato markdown ni explicaciones adicionales. Devuelve directamente el JSON crudo.`;

    const modelsToTry = options.preferredModel ? [options.preferredModel, ...this.defaultModels] : this.defaultModels;
    const timeoutMs = options.timeoutMs ?? 10000;
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const body: Record<string, unknown> = {
          contents: [{ parts: [{ text: structuredPrompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.1,
            maxOutputTokens: options.maxTokens ?? 1000,
            responseMimeType: 'application/json',
          },
        };

        if (options.systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
          };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (rawText) {
            // Limpieza preventiva de bloques markdown si el modelo los incluyó
            const cleanedJson = rawText
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim();

            const parsed = JSON.parse(cleanedJson);
            const validation = schema.safeParse(parsed);

            if (validation.success) {
              return validation.data;
            } else {
              console.warn(`[GeminiAdapter] Schema validation error en modelo ${model}:`, validation.error.format());
              lastError = new AiSchemaValidationError('La respuesta de la IA no cumple el esquema Zod requerido', validation.error.issues);
            }
          }
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[GeminiAdapter] Error en structured generation (${model}):`, lastError.message);
      }
    }

    if (lastError instanceof AiSchemaValidationError) {
      throw lastError;
    }

    throw new AiProviderError(
      `Fallo en la generación estructurada con Gemini: ${lastError?.message || 'Error desconocido'}`,
      'STRUCTURED_GENERATION_FAILED',
      503
    );
  }
}
