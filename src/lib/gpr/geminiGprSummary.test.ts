import { describe, it, expect } from 'vitest';
import {
  formatDiameter,
  parseProjectDescriptionAndTargets,
  buildDeterministicSummary,
} from './geminiGprSummary';

describe('GPR Gemini Summary Utility Functions', () => {
  describe('formatDiameter', () => {
    it('should format numeric strings as inches with diameter symbol', () => {
      expect(formatDiameter('4')).toBe('Ø 4"');
      expect(formatDiameter('2.5')).toBe('Ø 2.5"');
    });

    it('should preserve units if already present with diameter symbol or mm', () => {
      expect(formatDiameter('Ø 4"')).toBe('Ø 4"');
      expect(formatDiameter('100 mm')).toBe('100 mm');
    });

    it('should return empty string for empty or invalid values', () => {
      expect(formatDiameter('')).toBe('');
      expect(formatDiameter(null)).toBe('');
      expect(formatDiameter(undefined)).toBe('');
    });
  });

  describe('parseProjectDescriptionAndTargets', () => {
    it('should parse target ML from embedded tag and clean description', () => {
      const desc = 'Levantamiento geofísico tramo sur <!--PROJECT_TARGETS:{"target_ml":1500}-->';
      const result = parseProjectDescriptionAndTargets(desc);
      expect(result.targetMl).toBe(1500);
      expect(result.cleanDescription).toBe('Levantamiento geofísico tramo sur');
      expect(result.formattedTargetText).toContain('ML');
    });

    it('should clean embedded PROJECT_FINANCIALS comments and JSON without leaking', () => {
      const desc = 'PROYECTO DE APOYO<!--PROJECT_FINANCIALS:{"contract_value":100000000,"deductions_percentage":24}-->';
      const result = parseProjectDescriptionAndTargets(desc);
      expect(result.cleanDescription).toBe('PROYECTO DE APOYO');
      expect(result.cleanDescription).not.toContain('<!--');
      expect(result.cleanDescription).not.toContain('contract_value');
    });

    it('should handle clean description without tags gracefully', () => {
      const desc = 'Exploración de servicios en planta';
      const result = parseProjectDescriptionAndTargets(desc);
      expect(result.targetMl).toBeUndefined();
      expect(result.cleanDescription).toBe('Exploración de servicios en planta');
    });

    it('should return empty description for null or empty input', () => {
      const result = parseProjectDescriptionAndTargets(null);
      expect(result.cleanDescription).toBe('');
      expect(result.targetMl).toBeUndefined();
    });
  });

  describe('buildDeterministicSummary', () => {
    it('should NEVER output 0.0 m2 when area is zero', () => {
      const project = {
        name: 'DESARROLLO',
        client: 'PROCIMEC',
        location: 'BARRANQUILLA',
        description: 'PROYECTO DE APOYO<!--PROJECT_FINANCIALS:{"contract_value":100000000}-->',
      };
      const report = {
        report_date: '2026-10-19',
        localizador_name: 'Marcelo Barraza',
        gpr_equipment: 'GPR',
        global_max_depth: 6,
        terrain_conditions: 'Asfalto',
        weather_conditions: 'Soleado',
        cad_priority: 'Media',
        operational_summary: [
          { ml: 100, m2: 0 },
          { ml: 50, m2: 0 },
        ],
      };

      const summary = buildDeterministicSummary(project, report);
      expect(summary).not.toContain('0.0 m²');
      expect(summary).not.toContain('<!--PROJECT_FINANCIALS');
      expect(summary).toContain('150.0 metros lineales (ML) de exploración lineal');
      expect(summary).toContain('Marcelo Barraza');
      expect(summary).toContain('DESARROLLO (PROCIMEC)');
    });
  });
});
