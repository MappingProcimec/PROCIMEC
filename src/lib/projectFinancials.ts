import { ProjectDeduction, ProjectFinancials } from '@/types';

/**
 * Deducciones tributarias y contractuales canónicas en Colombia para contratos de ingeniería y obra.
 * El IVA viene predeterminado al 19% activo por defecto.
 * Incluye componente de A.I. (Administración e Imprevistos).
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
    name: 'Retención de ICA (ReteICA)',
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

/**
 * Realiza el cómputo aritmético O(1) de deducciones y valor neto de ejecución.
 * Cero consumo de CPU serverless; cálculo instantáneo.
 */
export function computeProjectFinancials(
  rawContractValue: number | string | null | undefined,
  rawDeductions?: ProjectDeduction[] | null
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

  const activeDeductionsPct = deductions_config
    .filter((d) => d.applies)
    .reduce((acc, d) => acc + (Number(d.percentage) || 0), 0);

  const deductions_percentage = Math.round(activeDeductionsPct * 1000) / 1000;
  const deductions_amount = Math.round(contract_value * (deductions_percentage / 100) * 100) / 100;
  const execution_value = Math.max(0, Math.round((contract_value - deductions_amount) * 100) / 100);

  return {
    contract_value,
    deductions_percentage,
    deductions_amount,
    execution_value,
    deductions_config,
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
