import { describe, it, expect } from 'vitest';
import { parseFormatName } from './hseq-drive';

describe('HSEQ Format Name Parser', () => {
  it('should map drone formats to FOR-HSEQ-024', () => {
    const res = parseFormatName('FOR-Inspección pre-operacional Drone.xlsx');
    expect(res.code).toBe('FOR-HSEQ-024');
    expect(res.title).toContain('DRONE');
  });

  it('should map total station formats to FOR-HSEQ-025', () => {
    const res = parseFormatName('FOR-Inspección pre-operacional Estación Total.xlsx');
    expect(res.code).toBe('FOR-HSEQ-025');
    expect(res.title).toContain('ESTACIÓN TOTAL');
  });

  it('should map GPS formats to FOR-HSEQ-026', () => {
    const res = parseFormatName('FOR-Inspección pre-operacional GPS.xlsx');
    expect(res.code).toBe('FOR-HSEQ-026');
    expect(res.title).toContain('GPS');
  });

  it('should map GPR formats to FOR-HSEQ-027', () => {
    const res = parseFormatName('FOR-Inspección pre-operacional GPR.xlsx');
    expect(res.code).toBe('FOR-HSEQ-027');
    expect(res.title).toContain('GEORADAR');
  });

  it('should map EM locator formats to FOR-HSEQ-028', () => {
    const res = parseFormatName('FOR-Inspección pre-operacional localizador electromagnetico.xlsx');
    expect(res.code).toBe('FOR-HSEQ-028');
    expect(res.title).toContain('LOCALIZADOR ELECTROMAGNÉTICO');
  });

  it('should map vehicle formats to FOR-HSEQ-029', () => {
    const res = parseFormatName('FOR-Inspección preoperacional del vehículo.xlsx');
    expect(res.code).toBe('FOR-HSEQ-029');
    expect(res.title).toContain('VEHÍCULO');
  });

  it('should parse custom FOR- codes accurately', () => {
    const res = parseFormatName('FOR-SIG-001 Análisis y Planificación de Cambios');
    expect(res.code).toBe('FOR-SIG-001');
    expect(res.title).toBe('ANÁLISIS Y PLANIFICACIÓN DE CAMBIOS');
  });
});
