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

  describe('computeProjectFinancials (Régimen Estándar y AIU)', () => {
    it('should correctly calculate financials with default deductions (19% IVA)', () => {
      const contractValue = 100_000_000;
      const result = computeProjectFinancials(contractValue);

      expect(result.contract_value).toBe(100_000_000);
      expect(result.deductions_percentage).toBe(19);
      expect(result.deductions_amount).toBe(19_000_000);
      expect(result.execution_value).toBe(81_000_000);
      expect(result.iva_amount).toBe(19_000_000);
      expect(result.withholdings_amount).toBe(0);
      expect(result.is_aiu_regime).toBe(false);
    });

    it('should calculate statutory AIU regime according to Art. 462-1 of Estatuto Tributario', () => {
      const contractValue = 100_000_000;
      // In engineering/construction contracts with AIU, IVA 19% applies only on the Utilidad component (e.g. 5%)
      const result = computeProjectFinancials(contractValue, null, {
        isAiuRegime: true,
        utilityPercentage: 5.0, // 5% de utilidad sobre el contrato
      });

      // Base gravable IVA = 5.000.000 (5% de 100M)
      expect(result.aiu_base_amount).toBe(5_000_000);
      // IVA 19% de 5.000.000 = 950.000
      expect(result.iva_amount).toBe(950_000);
      expect(result.deductions_amount).toBe(950_000);
      expect(result.execution_value).toBe(99_050_000);
      expect(result.is_aiu_regime).toBe(true);
    });

    it('should calculate AIU regime with withholdings (ReteFuente 2% + ReteICA 0.966%)', () => {
      const contractValue = 100_000_000;
      const customDeductions = [
        { id: 'iva', name: 'IVA', percentage: 19, applies: true },
        { id: 'retefuente', name: 'ReteFuente', percentage: 2.0, applies: true },
        { id: 'reteica', name: 'ReteICA', percentage: 0.966, applies: true },
      ];

      const result = computeProjectFinancials(contractValue, customDeductions, {
        isAiuRegime: true,
        utilityPercentage: 5.0,
      });

      // IVA 19% sobre 5M = 950.000
      expect(result.iva_amount).toBe(950_000);
      // Retenciones = 2.966% de 100M = 2.966.000
      expect(result.withholdings_amount).toBe(2_966_000);
      // Total deducción = 950.000 + 2.966.000 = 3.916.000
      expect(result.deductions_amount).toBe(3_916_000);
      // Desembolso neto = 100M - 2.966.000 = 97.034.000
      expect(result.net_disbursement_value).toBe(97_034_000);
    });

    it('should correctly compute with custom combined deductions in standard regime', () => {
      const contractValue = 50_000_000;
      const customDeductions = [
        { id: 'iva', name: 'IVA', percentage: 19, applies: true },
        { id: 'retefuente', name: 'ReteFuente', percentage: 2.0, applies: true },
        { id: 'ai', name: 'A.I.', percentage: 5.0, applies: true },
        { id: 'garantias', name: 'Garantías', percentage: 1.0, applies: false },
      ];

      const result = computeProjectFinancials(contractValue, customDeductions);

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
