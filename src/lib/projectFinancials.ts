import { ProjectDeduction, ProjectFinancials } from '@/types';

/**
 * Deducciones tributarias y contractuales canónicas en Colombia para contratos de ingeniería y obra.
 * Basado en el Estatuto Tributario de Colombia (E.T.):
 * - IVA (Art. 468 E.T. - Tarifa general 19%)
 * - ReteFuente (Art. 392 y concordantes - Servicios de ingeniería/construcción entre 2.0% y 4.0%)
 * - ReteICA (Acuerdo Distrital/Municipal - Bogotá base 9.66 por mil = 0.966%)
 * - A.I.U. (Administración, Imprevistos y Utilidades según Art. 462-1 E.T.)
 */
export const DEFAULT_COLOMBIA_DEDUCTIONS: ProjectDeduction[] = [
  {
    id: 'iva',
    name: 'IVA (Impuesto sobre las Ventas)',
    percentage: 19,
    applies: true,
  },
  {
    id: 'retefuente',
    name: 'Retención en la Fuente (ReteFuente)',
    percentage: 2.0,
    applies: false,
  },
  {
    id: 'reteica',
    name: 'Retención de ICA (ReteICA Bogotá 9.66‰)',
    percentage: 0.966,
    applies: false,
  },
  {
    id: 'ai',
    name: 'A.I. (Administración e Imprevistos)',
    percentage: 5.0,
    applies: false,
  },
  {
    id: 'reteiva',
    name: 'ReteIVA (Descuento sobre IVA)',
    percentage: 2.85,
    applies: false,
  },
  {
    id: 'estampillas',
    name: 'Estampillas / Gravámenes Estatales',
    percentage: 1.5,
    applies: false,
  },
  {
    id: 'garantias',
    name: 'Fondo de Pólizas y Garantías',
    percentage: 1.0,
    applies: false,
  },
];

export interface ComputeFinancialOptions {
  /**
   * Si es true, aplica el régimen tributario de contratos de obra o servicios integrales
   * con componente AIU (Art. 462-1 del Estatuto Tributario de Colombia), donde el IVA
   * del 19% se liquida exclusivamente sobre el componente de Utilidad pactado.
   */
  isAiuRegime?: boolean;
  /**
   * Porcentaje de Utilidad pactado dentro del AIU (por defecto 5% si no se declara).
   */
  utilityPercentage?: number;
}

/**
 * Realiza el cómputo aritmético O(1) de deducciones, valor neto de ejecución
 * y desglose tributario según el Estatuto Tributario colombiano.
 */
export function computeProjectFinancials(
  rawContractValue: number | string | null | undefined,
  rawDeductions?: ProjectDeduction[] | null,
  options?: ComputeFinancialOptions
): ProjectFinancials {
  const contract_value = Math.max(0, Number(rawContractValue) || 0);

  const deductions_config: ProjectDeduction[] = Array.isArray(rawDeductions) && rawDeductions.length > 0
    ? rawDeductions.map((d) => ({
        id: String(d.id || `ded-${Math.random()}`),
        name: String(d.name || 'Deducción'),
        percentage: Math.max(0, Number(d.percentage) || 0),
        applies: Boolean(d.applies),
        is_custom: Boolean(d.is_custom),
      }))
    : DEFAULT_COLOMBIA_DEDUCTIONS.map((d) => ({ ...d }));

  const isAiu = Boolean(options?.isAiuRegime);
  const utilityPct = options?.utilityPercentage !== undefined ? Math.max(0, options.utilityPercentage) : 5.0;

  // Separar IVA de retenciones en la fuente
  const ivaDeduction = deductions_config.find((d) => d.id === 'iva');
  const ivaApplies = Boolean(ivaDeduction?.applies);
  const ivaPct = ivaApplies ? Number(ivaDeduction?.percentage || 19) : 0;

  // Retenciones aplicables (excluyendo IVA para desglose)
  const withholdingsConfig = deductions_config.filter((d) => d.id !== 'iva' && d.applies);
  const withholdingsPct = withholdingsConfig.reduce((acc, d) => acc + (Number(d.percentage) || 0), 0);

  // Cálculo del IVA según régimen
  let iva_amount = 0;
  let aiu_base_amount = 0;

  if (ivaApplies) {
    if (isAiu) {
      // Art. 462-1 E.T.: La base gravable para el IVA en contratos con AIU es exclusivamente la Utilidad
      aiu_base_amount = Math.round(contract_value * (utilityPct / 100) * 100) / 100;
      iva_amount = Math.round(aiu_base_amount * (ivaPct / 100) * 100) / 100;
    } else {
      iva_amount = Math.round(contract_value * (ivaPct / 100) * 100) / 100;
    }
  }

  // Retenciones en la fuente (ReteFuente, ReteICA, estampillas, etc.)
  const withholdings_amount = Math.round(contract_value * (withholdingsPct / 100) * 100) / 100;

  // Deducción total estándar acumulada
  const activeDeductionsPct = deductions_config
    .filter((d) => d.applies)
    .reduce((acc, d) => acc + (Number(d.percentage) || 0), 0);

  const deductions_percentage = Math.round(activeDeductionsPct * 1000) / 1000;
  const deductions_amount = isAiu
    ? Math.round((iva_amount + withholdings_amount) * 100) / 100
    : Math.round(contract_value * (deductions_percentage / 100) * 100) / 100;

  const execution_value = Math.max(0, Math.round((contract_value - deductions_amount) * 100) / 100);
  const net_disbursement_value = Math.max(0, Math.round((contract_value - withholdings_amount) * 100) / 100);

  return {
    contract_value,
    deductions_percentage,
    deductions_amount,
    execution_value,
    deductions_config,
    iva_amount,
    withholdings_amount,
    net_disbursement_value,
    aiu_base_amount: isAiu ? aiu_base_amount : undefined,
    is_aiu_regime: isAiu,
  };
}

/**
 * Formateo estándar monetario en Pesos Colombianos ($ COP)
 */
export function formatCOP(amount: number | null | undefined): string {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(val);
}
