import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  MockAdapter,
  ExtractFieldDataUseCase,
  AuditHseqComplianceUseCase,
  fieldExtractionSchema,
} from './index';

describe('Gentle AI Architecture (Clean Architecture & Ports & Adapters)', () => {
  it('MockAdapter should implement AiPort and return simulated values', async () => {
    const mock = new MockAdapter('Respuesta de prueba');
    const text = await mock.generateText('Hola');
    expect(text).toBe('Respuesta de prueba');
  });

  it('ExtractFieldDataUseCase should correctly parse field notes with fallback', async () => {
    const mock = new MockAdapter();
    const useCase = new ExtractFieldDataUseCase(mock);

    const result = await useCase.execute({
      rawText: 'Exploramos 320 metros lineales con GPR en asfalto bajo clima soleado. Localizamos gas a 1.2m de profundidad.',
    });

    expect(result.metrics.linear_meters).toBe(320);
    expect(result.terrain_conditions).toBe('Asfalto');
    expect(result.weather_conditions).toBe('Soleado');
    expect(result.detected_utilities.some(u => u.type === 'Gas')).toBe(true);
  });

  it('AuditHseqComplianceUseCase should identify compliant and non-compliant records', async () => {
    const mock = new MockAdapter();
    const useCase = new AuditHseqComplianceUseCase(mock);

    const emptyAudit = await useCase.execute({
      formTitle: 'Inspección Preoperacional',
      formData: {},
    });
    expect(emptyAudit.is_compliant).toBe(false);
    expect(emptyAudit.approved_for_signature).toBe(false);

    const validAudit = await useCase.execute({
      formTitle: 'Inspección Preoperacional',
      formData: {
        operator_name: 'Carlos Ruiz',
        report_date: '2026-10-20',
        epp_completo: 'Si',
        frenos: 'Bueno',
      },
    });
    expect(validAudit.is_compliant).toBe(true);
    expect(validAudit.approved_for_signature).toBe(true);
  });
});
