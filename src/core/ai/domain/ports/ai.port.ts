import { z } from 'zod';
import { AiOptions } from '../models/ai.models';

/**
 * Puerto agnóstico de Inteligencia Artificial (Patrón Hexagonal / Ports & Adapters).
 * Define el contrato que cualquier proveedor (Gemini, Claude, OpenAI, Local) debe satisfacer.
 * Siguiendo el estándar de Gentleman Programming: Cero acoplamiento a SDKs específicos en el dominio.
 */
export interface AiPort {
  /**
   * Genera texto libre procesado por el modelo de IA.
   */
  generateText(prompt: string, options?: AiOptions): Promise<string>;

  /**
   * Genera una salida estructurada y tipada, validada de forma estricta contra un esquema Zod.
   * Si la respuesta del modelo no cumple el esquema, el adaptador debe manejar el reintento o lanzar un error tipado.
   */
  generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: AiOptions
  ): Promise<T>;
}
