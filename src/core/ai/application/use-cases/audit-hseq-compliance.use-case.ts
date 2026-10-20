import { AiPort } from '../../domain/ports/ai.port';
import { hseqAuditSchema, HseqAuditData } from '../../infrastructure/schemas/ai.schemas';

export interface AuditHseqCommand {
  formTitle: string;
  formCode?: string;
  formData: Record<string, unknown>;
  projectContext?: {
    name?: string;
    client?: string;
  };
}

/**
 * Caso de Uso: Auditoría Pre-Vuelo HSEQ y Calidad de Formatos.
 * Revisa que antes de estampar la firma legal (Ley 3 y Ley 8 de PROCIMEC),
 * el formulario cuente con toda la integridad técnica requerida.
 */
export class AuditHseqComplianceUseCase {
  constructor(private readonly aiPort: AiPort) {}

  public async execute(command: AuditHseqCommand): Promise<HseqAuditData> {
    const dataKeys = Object.keys(command.formData || {});

    // Validación preliminar estricta de formulario vacío
    if (dataKeys.length === 0) {
      return {
        is_compliant: false,
        compliance_score: 0,
        overall_assessment: 'El formulario no contiene datos registrados para auditar.',
        critical_risks: ['Formulario en blanco o sin parámetros operativos'],
        missing_requirements: ['Campos mandatorios de inspección y evidencias'],
        preventive_recommendations: ['Diligencie todos los ítems de verificación antes de proceder'],
        approved_for_signature: false,
      };
    }

    const prompt = `Evalúa la conformidad del siguiente formulario de seguridad industrial / HSEQ para PROCIMEC INGENIERÍA S.A.S.
Formato: "${command.formTitle}" (${command.formCode || 'Código no especificado'})
Proyecto: ${command.projectContext?.name || 'Operación general'} (Cliente: ${command.projectContext?.client || 'N/A'})

DATOS REGISTRADOS EN EL FORMULARIO:
${JSON.stringify(command.formData, null, 2)}

CRITERIOS DE AUDITORÍA HSEQ:
1. Revisa si hay ítems de verificación marcados como deficientes o "No Conforme" sin plan de acción o mitigación.
2. Comprueba si los campos críticos de responsable, equipos, fecha y condiciones seguras están completos.
3. Evalúa si el reporte está apto para ser firmado legalmente o si requiere subsanar inconsistencias.
4. Responde con un score de 0 a 100 y lista clara de riesgos o faltantes.`;

    try {
      const result = await this.aiPort.generateStructured<HseqAuditData>(
        prompt,
        hseqAuditSchema,
        {
          systemInstruction: 'Eres el Coordinador Nacional de HSEQ y Auditor Interno ISO 9001 / ISO 45001 de PROCIMEC INGENIERÍA S.A.S. Tu objetivo es prevenir accidentes y asegurar la calidad documental.',
          temperature: 0.1,
          timeoutMs: 9000,
        }
      );
      return result;
    } catch (err) {
      console.warn('[AuditHseqComplianceUseCase] Fallback de reglas locales activado:', err);
      return this.buildDeterministicAudit(command);
    }
  }

  private buildDeterministicAudit(command: AuditHseqCommand): HseqAuditData {
    const missing: string[] = [];
    const risks: string[] = [];
    let score = 95;

    const data = command.formData || {};
    if (!data.responsible && !data.operator_name && !data.localizador_name) {
      missing.push('Nombre del responsable o evaluador');
      score -= 20;
    }
    if (!data.date && !data.report_date) {
      missing.push('Fecha formal de la inspección');
      score -= 15;
    }

    // Revisar si hay campos con valores 'Malo' o 'No Conforme'
    const stringified = JSON.stringify(data).toLowerCase();
    if (stringified.includes('malo') || stringified.includes('no cumple') || stringified.includes('defectuoso')) {
      risks.push('Se detectaron componentes marcados como deficientes o no conformes');
      score -= 25;
    }

    const isCompliant = score >= 70 && missing.length === 0;

    return {
      is_compliant: isCompliant,
      compliance_score: Math.max(0, score),
      overall_assessment: isCompliant
        ? 'El formato cumple con los lineamientos básicos de integridad operativa verificado por motor de reglas.'
        : 'Se identificaron discrepancias o faltantes que deben corregirse antes de proceder a la firma legal.',
      critical_risks: risks,
      missing_requirements: missing,
      preventive_recommendations: [
        'Asegúrese de constatar en sitio la calibración de los equipos.',
        'Verifique el porte de elementos de protección personal (EPP) de toda la cuadrilla.',
      ],
      approved_for_signature: isCompliant,
    };
  }
}
