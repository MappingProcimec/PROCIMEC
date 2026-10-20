import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLOMBIA_DEDUCTIONS,
  computeProjectFinancials,
  formatCOP,
} from './projectFinancials';

describe('projectFinancials', () => {
  describe('DEFAULT_COLOMBIA_DEDUCTIONS', () => {
    it('should have IVA configured at 19% and enabled by default', () => {
      const iva = DEFAULT_COLOMBIA_DEDUCTIONS.find((d) => d.id === 'iva');
      expect(iva).toBeDefined();
      expect(iva?.percentage).toBe(19);
      expect(iva?.applies).toBe(true);
    });

    it('should have standard withholdings present in configuration', () => {
      const ids = DEFAULT_COLOMBIA_DEDUCTIONS.map((d) => d.id);
      expect(ids).toContain('retefuente');
      expect(ids).toContain('reteica');
      expect(ids).toContain('ai');
      expect(ids).toContain('estampillas');
    });
  });

  describe('computeProjectFinancials', () => {
    it('should correctly calculate financials with default deductions (19% IVA)', () => {
      const contractValue = 100_000_000;
      const result = computeProjectFinancials(contractValue);

      expect(result.contract_value).toBe(100_000_000);
      expect(result.deductions_percentage).toBe(19);
      expect(result.deductions_amount).toBe(19_000_000);
      expect(result.execution_value).toBe(81_000_000);
      expect(result.deductions_config.length).toBe(DEFAULT_COLOMBIA_DEDUCTIONS.length);
    });

    it('should correctly compute with custom combined deductions', () => {
      const contractValue = 50_000_000;
      const customDeductions = [
        { id: 'iva', name: 'IVA', percentage: 19, applies: true },
        { id: 'retefuente', name: 'ReteFuente', percentage: 2.0, applies: true },
        { id: 'ai', name: 'A.I.', percentage: 5.0, applies: true },
        { id: 'garantias', name: 'Garantías', percentage: 1.0, applies: false },
      ];

      const result = computeProjectFinancials(contractValue, customDeductions);

      // Total applies: 19 + 2 + 5 = 26%
      expect(result.contract_value).toBe(50_000_000);
      expect(result.deductions_percentage).toBe(26);
      expect(result.deductions_amount).toBe(13_000_000);
      expect(result.execution_value).toBe(37_000_000);
    });

    it('should return 0 deductions when no deductions apply', () => {
      const customDeductions = [
        { id: 'iva', name: 'IVA', percentage: 19, applies: false },
        { id: 'retefuente', name: 'ReteFuente', percentage: 2.0, applies: false },
      ];

      const result = computeProjectFinancials(20_000_000, customDeductions);

      expect(result.deductions_percentage).toBe(0);
      expect(result.deductions_amount).toBe(0);
      expect(result.execution_value).toBe(20_000_000);
    });

    it('should safely handle zero, null, undefined and negative contract values', () => {
      const resNull = computeProjectFinancials(null);
      expect(resNull.contract_value).toBe(0);
      expect(resNull.deductions_amount).toBe(0);
      expect(resNull.execution_value).toBe(0);

      const resUndefined = computeProjectFinancials(undefined);
      expect(resUndefined.contract_value).toBe(0);

      const resNegative = computeProjectFinancials(-5000);
      expect(resNegative.contract_value).toBe(0);
      expect(resNegative.execution_value).toBe(0);
    });

    it('should parse valid string contract values properly', () => {
      const result = computeProjectFinancials('10000000');
      expect(result.contract_value).toBe(10_000_000);
      expect(result.deductions_amount).toBe(1_900_000);
      expect(result.execution_value).toBe(8_100_000);
    });
  });

  describe('formatCOP', () => {
    it('should format amounts into standard COP representation', () => {
      const formatted = formatCOP(1_000_000);
      // Clean non-breaking spaces for regex/string match
      const sanitized = formatted.replace(/\u00a0/g, ' ');
      expect(sanitized).toMatch(/COP|[\$\s]1\.000\.000/);
    });

    it('should handle zero, null and undefined gracefully', () => {
      const zero = formatCOP(0).replace(/\u00a0/g, ' ');
      expect(zero).toMatch(/0/);

      const fromNull = formatCOP(null).replace(/\u00a0/g, ' ');
      expect(fromNull).toMatch(/0/);

      const fromUndefined = formatCOP(undefined).replace(/\u00a0/g, ' ');
      expect(fromUndefined).toMatch(/0/);
    });
  });
});
