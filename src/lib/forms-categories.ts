/**
 * GOBERNANZA CANÓNICA DE CATEGORÍAS DE FORMULARIOS (PROCIMEC PCM CLOUD)
 * Define las únicas 9 áreas operacionales válidas para los formularios de la plataforma.
 * Queda estrictamente erradicada la categoría 'general' (no existe rol ni área general).
 */

export type CanonicalFormCategory = 
  | 'gpr' 
  | 'cad' 
  | 'hseq' 
  | 'warehouse' 
  | 'purchasing' 
  | 'commercial' 
  | 'finance' 
  | 'accounting' 
  | 'rrhh';

export interface FormCategoryMeta {
  key: CanonicalFormCategory;
  label: string;
  badgeLabel: string;
  bg: string;
  border: string;
  text: string;
}

export const CANONICAL_CATEGORY_STYLES: Record<CanonicalFormCategory, FormCategoryMeta> = {
  gpr: {
    key: 'gpr',
    label: 'GPR / Geofísica',
    badgeLabel: 'GPR / Geofísica',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
  },
  cad: {
    key: 'cad',
    label: 'CAD / BIM',
    badgeLabel: 'CAD / BIM',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
  },
  hseq: {
    key: 'hseq',
    label: 'HSEQ / SIG',
    badgeLabel: 'HSEQ / SIG',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
  },
  warehouse: {
    key: 'warehouse',
    label: 'Almacén',
    badgeLabel: 'Almacén',
    bg: 'bg-amber-100/70',
    border: 'border-amber-300',
    text: 'text-amber-900',
  },
  purchasing: {
    key: 'purchasing',
    label: 'Compras',
    badgeLabel: 'Compras',
    bg: 'bg-blue-100/70',
    border: 'border-blue-300',
    text: 'text-blue-900',
  },
  commercial: {
    key: 'commercial',
    label: 'Comercial',
    badgeLabel: 'Comercial',
    bg: 'bg-emerald-100/70',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
  },
  finance: {
    key: 'finance',
    label: 'Finanzas',
    badgeLabel: 'Finanzas',
    bg: 'bg-violet-100/70',
    border: 'border-violet-300',
    text: 'text-violet-900',
  },
  accounting: {
    key: 'accounting',
    label: 'Contabilidad',
    badgeLabel: 'Contabilidad',
    bg: 'bg-cyan-100/70',
    border: 'border-cyan-300',
    text: 'text-cyan-900',
  },
  rrhh: {
    key: 'rrhh',
    label: 'Recursos Humanos',
    badgeLabel: 'Recursos Humanos',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-800',
  },
};

export const ORDERED_CANONICAL_KEYS: readonly ('all' | CanonicalFormCategory)[] = [
  'all',
  'gpr',
  'cad',
  'warehouse',
  'purchasing',
  'commercial',
  'finance',
  'accounting',
  'hseq',
  'rrhh',
] as const;

/**
 * Mapeo explícito de formularios conocidos a su categoría canónica
 */
export const FORM_CATEGORY_MAP: Record<string, CanonicalFormCategory> = {
  // GPR
  'gpr-field-form': 'gpr',
  'gpr-report': 'gpr',

  // CAD / BIM
  'cad-register-form': 'cad',
  'cad-register': 'cad',
  'nueva-actividad': 'cad',

  // HSEQ / SIG (Sistema Integrado de Gestión)
  'hseq-report': 'hseq',
  'hseq': 'hseq',
  'analisis-planificacion-cambios-sig': 'hseq',
  'cambios-sig': 'hseq',
  'gestion-cambio': 'hseq',

  // Almacén
  'registro-equipo': 'warehouse',
  'despacho-equipo': 'warehouse',
  'retorno-equipo': 'warehouse',
  'alta-equipo': 'warehouse',
  'equipo-nuevo': 'warehouse',

  // Compras
  'requerimiento-compra': 'purchasing',
  'orden-compra': 'purchasing',
  'evaluacion-proveedor': 'purchasing',
  'registro-proveedor': 'purchasing',

  // Comercial
  'registro-oportunidad': 'commercial',
  'presupuesto-proyecto': 'commercial',
  'cotizacion-comercial': 'commercial',
  'cierre-comercial': 'commercial',

  // Finanzas
  'solicitud-viaticos': 'finance',
  'legalizacion-gastos': 'finance',
  'registro-pago': 'finance',

  // Contabilidad
  'radicacion-factura': 'accounting',
  'soporte-cobro': 'accounting',

  // Recursos Humanos
  'elaboracion-cartas': 'rrhh',
  'cartas': 'rrhh',
  'cartas-rrhh': 'rrhh',
};

/**
 * Resuelve y garantiza la categoría canónica para cualquier formulario actual o futuro.
 * Regla de Oro: NUNCA retorna 'general'. Si se crea un nuevo formulario en el futuro
 * sin registrarlo explícitamente, este motor semántico detecta sus palabras clave
 * o lo adscribe por defecto al Sistema Integrado de Gestión (HSEQ / SIG).
 */
export function resolveCanonicalFormCategory(slug: string, name?: string): CanonicalFormCategory {
  const cleanSlug = (slug || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();

  // 1. Coincidencia directa en el mapa maestro
  if (FORM_CATEGORY_MAP[cleanSlug]) {
    return FORM_CATEGORY_MAP[cleanSlug];
  }

  // 2. Reglas semánticas deterministas para nuevos formularios futuros
  const combined = `${cleanSlug} ${cleanName}`;

  if (
    combined.includes('sig') ||
    combined.includes('hseq') ||
    combined.includes('cambio') ||
    combined.includes('inspeccion') ||
    combined.includes('seguridad') ||
    combined.includes('sst') ||
    combined.includes('calidad') ||
    combined.includes('riesgo') ||
    combined.includes('incidente')
  ) {
    return 'hseq';
  }

  if (
    combined.includes('gpr') ||
    combined.includes('radar') ||
    combined.includes('geofis') ||
    combined.includes('localiz') ||
    combined.includes('subsuperf')
  ) {
    return 'gpr';
  }

  if (
    combined.includes('cad') ||
    combined.includes('bim') ||
    combined.includes('dwg') ||
    combined.includes('rvt') ||
    combined.includes('dibujo') ||
    combined.includes('modelo') ||
    combined.includes('plano')
  ) {
    return 'cad';
  }

  if (
    combined.includes('equipo') ||
    combined.includes('almacen') ||
    combined.includes('bodega') ||
    combined.includes('stock') ||
    combined.includes('inventario') ||
    combined.includes('despacho') ||
    combined.includes('retorno') ||
    combined.includes('herramienta')
  ) {
    return 'warehouse';
  }

  if (
    combined.includes('compra') ||
    combined.includes('proveedor') ||
    combined.includes('insumo') ||
    combined.includes('requerimiento') ||
    combined.includes('orden')
  ) {
    return 'purchasing';
  }

  if (
    combined.includes('comercial') ||
    combined.includes('oportunidad') ||
    combined.includes('licitacion') ||
    combined.includes('cotizacion') ||
    combined.includes('cierre') ||
    combined.includes('cliente') ||
    combined.includes('presupuesto') ||
    combined.includes('apu')
  ) {
    return 'commercial';
  }

  if (
    combined.includes('viatico') ||
    combined.includes('gasto') ||
    combined.includes('pago') ||
    combined.includes('tesoreria') ||
    combined.includes('egreso') ||
    combined.includes('anticipo') ||
    combined.includes('caja')
  ) {
    return 'finance';
  }

  if (
    combined.includes('factura') ||
    combined.includes('cobro') ||
    combined.includes('contab') ||
    combined.includes('acta') ||
    combined.includes('radicacion')
  ) {
    return 'accounting';
  }

  if (
    combined.includes('carta') ||
    combined.includes('rrhh') ||
    combined.includes('laboral') ||
    combined.includes('talento') ||
    combined.includes('empleado') ||
    combined.includes('personal') ||
    combined.includes('permiso')
  ) {
    return 'rrhh';
  }

  // 3. Salvaguarda institucional estricta: todo formato operativo de cumplimiento
  // transversal no catalogado pertenece al Sistema Integrado de Gestión (HSEQ & SIG).
  return 'hseq';
}
