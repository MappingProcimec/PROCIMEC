import { AiPort } from '../../domain/ports/ai.port';
import { fieldExtractionSchema, FieldExtractionData } from '../../infrastructure/schemas/ai.schemas';

export interface ExtractFieldDataCommand {
  rawText: string;
  projectContext?: {
    name?: string;
    client?: string;
    location?: string;
  };
}

/**
 * Caso de Uso: Extracción de Datos de Campo a partir de Voz o Notas Libres.
 * Sigue la regla de Gentleman Programming: La lógica de negocio orquesta el puerto de IA
 * y valida los datos con esquemas Zod rigurosos.
 */
export class ExtractFieldDataUseCase {
  constructor(private readonly aiPort: AiPort) {}

  public async execute(command: ExtractFieldDataCommand): Promise<FieldExtractionData> {
    const cleanText = command.rawText?.trim();

    if (!cleanText) {
      return this.buildEmptyResult('No se proporcionó texto para procesar.');
    }

    const systemInstruction = `Eres un Ingeniero Geofísico y Revisor de Operaciones Senior en PROCIMEC INGENIERÍA S.A.S.
Tu función es extraer metadatos técnicos estructurados a partir de notas de voz transcritas o apuntes rápidos de los operadores en campo.
Sé estricto con las unidades métricas, diámetros de tuberías y tipos de interferencias detectadas.`;

    const prompt = `Analiza la siguiente nota operativa de campo y extrae los datos técnicos en formato JSON conforme al esquema:

CONTEXTO DEL PROYECTO:
- Nombre: ${command.projectContext?.name || 'Operación en campo'}
- Cliente: ${command.projectContext?.client || 'General'}
- Ubicación: ${command.projectContext?.location || 'Sitio'}

NOTA DE CAMPO / TRANSCRIPCIÓN:
"${cleanText}"

REGLAS DE EXTRACCIÓN:
1. linear_meters: Número en ML si se menciona avance ("300 metros", "350 ml").
2. square_meters: Número en m2 si se deduce o menciona.
3. max_depth_m: Profundidad máxima explorada o indicada.
4. detected_utilities: Lista de servicios subterráneos (Gas, Agua, Energía, Telecomunicaciones, Alcantarillado) con su diámetro (ej: Ø 4", 2 pulg, 100mm) y profundidad.
5. terrain_conditions: Asfalto, Concreto, Adoquín, Destapado, Tierra, etc.
6. weather_conditions: Soleado, Lluvia, Nublado, etc.
7. anomalies_or_notes: Restricciones de tránsito, interferencias visuales o incidentes.`;

    try {
      const structuredResult = await this.aiPort.generateStructured<FieldExtractionData>(
        prompt,
        fieldExtractionSchema,
        {
          systemInstruction,
          temperature: 0.1,
          timeoutMs: 9000,
        }
      );
      return structuredResult;
    } catch (err) {
      console.warn('[ExtractFieldDataUseCase] Fallback determinista activado debido a error en IA:', err);
      return this.buildDeterministicExtraction(cleanText);
    }
  }

  /**
   * Fallback determinista heurístico (Circuit Breaker) cuando la IA no está disponible o falla la red.
   */
  private buildDeterministicExtraction(rawText: string): FieldExtractionData {
    // Extracción básica por expresiones regulares de seguridad
    const mlMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:ml|metros\s+lineales|m\s+lineales)/i);
    const depthMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:m|metros)?\s*(?:de\s+)?profundidad/i);

    const utilities = [];
    if (/gas/i.test(rawText)) utilities.push({ type: 'Gas', confidence: 'Media' as const });
    if (/agua|acueducto/i.test(rawText)) utilities.push({ type: 'Acueducto', confidence: 'Media' as const });
    if (/energ[ií]a|el[eé]ctric/i.test(rawText)) utilities.push({ type: 'Eléctrico', confidence: 'Media' as const });
    if (/telecom|fibra|tel[eé]fono/i.test(rawText)) utilities.push({ type: 'Telecomunicaciones', confidence: 'Media' as const });
    if (/alcantarillado|pluvial|sanitari/i.test(rawText)) utilities.push({ type: 'Alcantarillado', confidence: 'Media' as const });

    return {
      summary: rawText.length > 200 ? `${rawText.slice(0, 197)}...` : rawText,
      metrics: {
        linear_meters: mlMatch ? parseFloat(mlMatch[1]) : null,
        square_meters: null,
        max_depth_m: depthMatch ? parseFloat(depthMatch[1]) : null,
      },
      equipment: ['Georadar GPR', 'GPS GNSS'],
      detected_utilities: utilities,
      terrain_conditions: /asfalto/i.test(rawText) ? 'Asfalto' : /concreto/i.test(rawText) ? 'Concreto' : undefined,
      weather_conditions: /soleado/i.test(rawText) ? 'Soleado' : /lluvia/i.test(rawText) ? 'Lluvia' : undefined,
      anomalies_or_notes: 'Procesado mediante motor heurístico de respaldo.',
      confidence_score: 75,
    };
  }

  private buildEmptyResult(reason: string): FieldExtractionData {
    return {
      summary: reason,
      metrics: { linear_meters: null, square_meters: null, max_depth_m: null },
      equipment: [],
      detected_utilities: [],
      confidence_score: 0,
    };
  }
}
