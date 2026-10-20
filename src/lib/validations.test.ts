import { describe, it, expect } from 'vitest';
import {
  operationalRowSchema,
  detectedUtilitySchema,
  section1Schema,
  section2Schema,
  createProjectSchema,
} from './validations';

describe('validations', () => {
  describe('operationalRowSchema', () => {
    it('should validate a valid operational row', () => {
      const valid = {
        id: 'row-1',
        sector: 'Sector Norte - Tramo A',
        ml: 120.5,
        m2: 60.2,
        max_depth_m: 2.1,
        observations: 'Terreno rocoso',
      };
      const result = operationalRowSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should allow empty string literals for numeric metrics', () => {
      const validWithBlanks = {
        id: 'row-2',
        sector: 'Sector Sur',
        ml: '',
        m2: '',
        max_depth_m: '',
        observations: '',
      };
      const result = operationalRowSchema.safeParse(validWithBlanks);
      expect(result.success).toBe(true);
    });

    it('should reject when sector is missing or empty', () => {
      const invalid = {
        id: 'row-3',
        sector: '',
        ml: 10,
        m2: 20,
        max_depth_m: 1,
        observations: '',
      };
      const result = operationalRowSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('detectedUtilitySchema', () => {
    it('should accept valid utility data with supported confidence levels', () => {
      const utility = {
        id: 'ut-1',
        type: 'Gas',
        estimated_depth_m: 1.2,
        confidence: 'Alta' as const,
        description: 'Tubería metálica de gas 2 pulgadas',
      };
      const result = detectedUtilitySchema.safeParse(utility);
      expect(result.success).toBe(true);
    });

    it('should reject invalid confidence level', () => {
      const invalid = {
        id: 'ut-2',
        type: 'Agua',
        estimated_depth_m: 0.8,
        confidence: 'Insegura',
        description: 'Tubería PVC',
      };
      const result = detectedUtilitySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('section1Schema', () => {
    const baseSection1 = {
      report_date: '2026-10-20',
      localizador_name: 'Carlos Mendoza',
      equipments_used: ['GPR Malå Easy Locator HDR'],
      positioning_equipment: 'GPS Diferencial RTK',
      terrain_conditions: 'Pavimento asfáltico seco',
      capture_method: 'Cuadrícula ortogonal 0.5m',
    };

    it('should validate a complete and correct section 1', () => {
      const result = section1Schema.safeParse(baseSection1);
      expect(result.success).toBe(true);
    });

    it('should reject when both equipments_used is Ninguno AND positioning is Sin posicionamiento', () => {
      const invalid = {
        ...baseSection1,
        equipments_used: ['Ninguno'],
        positioning_equipment: 'Sin posicionamiento',
      };
      const result = section1Schema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Debes registrar al menos un equipo');
      }
    });

    it('should allow Ninguno in equipments if positioning equipment is specified', () => {
      const valid = {
        ...baseSection1,
        equipments_used: ['Ninguno'],
        positioning_equipment: 'Estación Total Leica',
      };
      const result = section1Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('section2Schema', () => {
    it('should validate section 2 with valid cad_priority', () => {
      const valid = {
        antenna_frequency: '450 MHz',
        rdp_value: '9.0',
        cad_priority: 'Alta' as const,
        processing_recommendations: 'Aplicar filtro Hilbert y deconvolución',
      };
      const result = section2Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject section 2 with invalid cad_priority', () => {
      const invalid = {
        cad_priority: 'Urgente',
      };
      const result = section2Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createProjectSchema', () => {
    it('should validate and transform project creation payload properly', () => {
      const input = {
        cost_center: 'CC-2026-001',
        name: 'Inspección Subterránea Autopista Norte',
        client: 'Consorcio Vial 2026',
        location: 'Bogotá D.C.',
        contract_value: '50000000',
        target_ml: '1500',
      };

      const result = createProjectSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cost_center).toBe('CC-2026-001');
        expect(result.data.contract_value).toBe(50000000);
        expect(result.data.target_ml).toBe(1500);
        expect(result.data.requires_mapping).toBe(true);
      }
    });

    it('should accept code as fallback for cost_center', () => {
      const input = {
        code: 'CC-CODE-099',
        name: 'Proyecto Minero Carbón',
        client: 'Cerrejón',
        location: 'La Guajira',
      };

      const result = createProjectSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cost_center).toBe('CC-CODE-099');
      }
    });

    it('should reject if both cost_center and code are empty', () => {
      const input = {
        name: 'Proyecto Sin Código',
        client: 'Cliente X',
        location: 'Cali',
      };

      const result = createProjectSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('cost_center'))).toBe(true);
      }
    });
  });
});
