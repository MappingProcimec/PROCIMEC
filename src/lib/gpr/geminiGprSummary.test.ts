import { describe, it, expect } from 'vitest';
import { formatDiameter, parseProjectDescriptionAndTargets } from './geminiGprSummary';

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
});
