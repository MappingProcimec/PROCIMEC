import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface FormatVersionHistoryItem {
  id: string;
  format_id: string;
  version: string;
  change_date: string;
  change_reason: string;
  responsible_name: string;
  file_url?: string | null;
  file_format: string;
  created_at?: string;
}

export interface DocumentFormatItem {
  id: string;
  code: string;
  name: string;
  process: string;
  form_slug?: string | null;
  roles_access: string[];
  is_universal: boolean;
  current_version: string;
  effective_date: string;
  status: 'active' | 'obsolete' | 'draft';
  category: string;
  description?: string | null;
  download_template_url?: string | null;
  editable_type: 'xlsx' | 'docx' | 'pptx';
  has_pptx?: boolean;
  has_xlsx?: boolean;
  versions_count: number;
  history: FormatVersionHistoryItem[];
}

// Catálogo maestro oficial de formatos reales correspondientes a los formularios existentes
const MASTER_FORMATS_SEED: Omit<DocumentFormatItem, 'id' | 'versions_count'>[] = [
  // ─── HSEQ & SIG ─────────────────────────────────────────────────────────────
  {
    code: 'FOR-SIG-001',
    name: 'Análisis y Planificación de Cambios',
    process: 'HSEQ & SIG',
    form_slug: 'analisis-planificacion-cambios-sig',
    roles_access: ['HSEQ', 'Gerencia', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-10-01',
    status: 'active',
    category: 'hseq',
    description: 'Identificación, evaluación de riesgos, actividades, aprobación y efectividad para cambios que afecten al Sistema Integrado de Gestión.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-SIG-001&format=editable',
    history: [
      {
        id: 'h-sig-1',
        format_id: 'seed-sig-1',
        version: '1',
        change_date: '2026-10-01',
        change_reason: 'Emisión inicial oficial del formato para análisis y planificación de cambios bajo norma ISO 9001 / ISO 45001.',
        responsible_name: 'Dirección HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-024',
    name: 'Inspección Pre-operacional de Drone',
    process: 'HSEQ & SIG',
    form_slug: 'hseq-report',
    roles_access: ['HSEQ', 'Localizador', 'Admin'],
    is_universal: false,
    current_version: '2',
    effective_date: '2026-09-16',
    status: 'active',
    category: 'hseq',
    description: 'Inspección pre-operacional obligatoria diaria para equipos aéreos pilotados a distancia (RPA/Drone), control remoto, baterías y sensores.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-024&format=editable',
    history: [
      {
        id: 'h-024-2',
        format_id: 'seed-024',
        version: '2',
        change_date: '2026-09-16',
        change_reason: 'Ampliación a 6 secciones técnicas, verificación de frecuencias, gimbal, hélices y firmas digitales.',
        responsible_name: 'Dirección HSEQ',
        file_format: 'xlsx',
      },
      {
        id: 'h-024-1',
        format_id: 'seed-024',
        version: '1',
        change_date: '2026-08-15',
        change_reason: 'Creación preliminar del formato de chequeo de aeronaves no tripuladas.',
        responsible_name: 'Coordinación HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-025',
    name: 'Inspección Pre-operacional de Estación Total',
    process: 'HSEQ & SIG',
    form_slug: 'hseq-report',
    roles_access: ['HSEQ', 'Localizador', 'Dibujo', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-10',
    status: 'active',
    category: 'hseq',
    description: 'Lista de verificación previa al uso de instrumental de precisión topográfica óptica-electrónica y prisma.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-025&format=editable',
    history: [
      {
        id: 'h-025-1',
        format_id: 'seed-025',
        version: '1',
        change_date: '2026-09-10',
        change_reason: 'Estandarización del formato de inspección de estación total, plomada óptica, compensador y trípode.',
        responsible_name: 'Coordinación HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-026',
    name: 'Inspección Pre-operacional de GPS Diferencial (GNSS)',
    process: 'HSEQ & SIG',
    form_slug: 'hseq-report',
    roles_access: ['HSEQ', 'Localizador', 'Dibujo', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-10',
    status: 'active',
    category: 'hseq',
    description: 'Inspección de receptor base, rover, colectora de datos, mástil y enlaces de radio de receptores GNSS.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-026&format=editable',
    history: [
      {
        id: 'h-026-1',
        format_id: 'seed-026',
        version: '1',
        change_date: '2026-09-10',
        change_reason: 'Creación del formato de verificación de equipos GNSS y colectora de datos.',
        responsible_name: 'Coordinación HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-027',
    name: 'Inspección Pre-operacional de Georadar (GPR)',
    process: 'HSEQ & SIG',
    form_slug: 'hseq-report',
    roles_access: ['HSEQ', 'Localizador', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-10',
    status: 'active',
    category: 'hseq',
    description: 'Chequeo de estructura, odómetro de rueda, antena blindada GPR, unidad Akula y computadora de control.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-027&format=editable',
    history: [
      {
        id: 'h-027-1',
        format_id: 'seed-027',
        version: '1',
        change_date: '2026-09-10',
        change_reason: 'Estandarización de inspección física y funcional para unidades GPR Sensors & Software y Akula.',
        responsible_name: 'Dirección HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-028',
    name: 'Inspección Pre-operacional de Localizador Electromagnético',
    process: 'HSEQ & SIG',
    form_slug: 'hseq-report',
    roles_access: ['HSEQ', 'Localizador', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-10',
    status: 'active',
    category: 'hseq',
    description: 'Inspección técnica de transmisor (TX), receptor (RX), pinzas de inducción y cableado de localizadores electromagnéticos.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-028&format=editable',
    history: [
      {
        id: 'h-028-1',
        format_id: 'seed-028',
        version: '1',
        change_date: '2026-09-10',
        change_reason: 'Creación del checklist preoperacional para equipos electromagnéticos RD8100 y similares.',
        responsible_name: 'Coordinación HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-029',
    name: 'Inspección Pre-operacional de Vehículo (PESV)',
    process: 'HSEQ & SIG',
    form_slug: 'hseq-report',
    roles_access: ['Todos los Roles'],
    is_universal: true,
    current_version: '4',
    effective_date: '2026-09-22',
    status: 'active',
    category: 'hseq',
    description: 'Inspección integral preoperacional de seguridad vial (PESV) para camionetas y vehículos de la empresa.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-029&format=editable',
    history: [
      {
        id: 'h-029-4',
        format_id: 'seed-029',
        version: '4',
        change_date: '2026-09-22',
        change_reason: 'Consolidación de 41 ítems en 5 secciones según Plan Estratégico de Seguridad Vial (PESV).',
        responsible_name: 'Dirección HSEQ',
        file_format: 'xlsx',
      },
      {
        id: 'h-029-3',
        format_id: 'seed-029',
        version: '3',
        change_date: '2026-08-15',
        change_reason: 'Validación estricta de SOAT, tecnomecánica y tarjeta de propiedad.',
        responsible_name: 'HSEQ',
        file_format: 'xlsx',
      },
      {
        id: 'h-029-2',
        format_id: 'seed-029',
        version: '2',
        change_date: '2026-07-01',
        change_reason: 'Inclusión de kit de derrames, botiquín y extintor según normativa de tránsito.',
        responsible_name: 'HSEQ',
        file_format: 'xlsx',
      },
      {
        id: 'h-029-1',
        format_id: 'seed-029',
        version: '1',
        change_date: '2026-05-10',
        change_reason: 'Formato inicial de revisión preoperacional de vehículos.',
        responsible_name: 'HSEQ',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-HSEQ-001',
    name: 'Registro de Asistencia Diaria y Preoperacional',
    process: 'HSEQ & SIG',
    form_slug: 'tools/attendance-tracker',
    roles_access: ['Todos los Roles'],
    is_universal: true,
    current_version: '2',
    effective_date: '2026-10-06',
    status: 'active',
    category: 'hseq',
    description: 'Control de presencia matutina, georreferenciación GPS, aptitud física pre-turno y reporte de salidas intermedias.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-HSEQ-001&format=editable',
    history: [
      {
        id: 'h-001-2',
        format_id: 'seed-001',
        version: '2',
        change_date: '2026-10-06',
        change_reason: 'Digitalización completa con geolocalización satelital, registro de pausas y salidas intermedias.',
        responsible_name: 'Gerencia Técnica',
        file_format: 'xlsx',
      },
      {
        id: 'h-001-1',
        format_id: 'seed-001',
        version: '1',
        change_date: '2026-08-01',
        change_reason: 'Planilla manual de registro de asistencia en campo y oficina.',
        responsible_name: 'Talento Humano / HSEQ',
        file_format: 'xlsx',
      },
    ],
  },

  // ─── OPERACIONES GPR / GEOFÍSICA ──────────────────────────────────────────
  {
    code: 'FOR-GPR-001',
    name: 'Reporte Diario de Campo y Exploración GPR',
    process: 'Operaciones GPR / Geofísica',
    form_slug: 'gpr-field-form',
    roles_access: ['Localizador', 'Admin'],
    is_universal: false,
    current_version: '2',
    effective_date: '2026-10-06',
    status: 'active',
    category: 'gpr',
    description: 'Reporte operacional de exploración en campo, metros lineales levantados, frentes de obra, fotos y radargramas procesados.',
    editable_type: 'docx',
    has_pptx: true,
    download_template_url: '/api/tools/version-control/download-template?code=FOR-GPR-001&format=editable',
    history: [
      {
        id: 'h-gpr-2',
        format_id: 'seed-gpr',
        version: '2',
        change_date: '2026-10-06',
        change_reason: 'Incorporación de exportación Word (.docx) con fotos y PowerPoint (.pptx) de radargramas.',
        responsible_name: 'Operaciones GPR',
        file_format: 'docx',
      },
      {
        id: 'h-gpr-1',
        format_id: 'seed-gpr',
        version: '1',
        change_date: '2026-08-20',
        change_reason: 'Formato inicial de reporte de metros lineales por frente de trabajo.',
        responsible_name: 'Operaciones',
        file_format: 'docx',
      },
    ],
  },

  // ─── INGENIERÍA Y DIBUJO CAD / BIM ────────────────────────────────────────
  {
    code: 'FOR-CAD-001',
    name: 'Bitácora de Modelado y Producción CAD / BIM',
    process: 'Ingeniería y Dibujo CAD/BIM',
    form_slug: 'cad-register-form',
    roles_access: ['Dibujo', 'Admin'],
    is_universal: false,
    current_version: '2',
    effective_date: '2026-10-06',
    status: 'active',
    category: 'cad',
    description: 'Registro de actividades de modelado, planimetría, Civil 3D, fases de entrega y control de reprocesos.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-CAD-001&format=editable',
    history: [
      {
        id: 'h-cad-2',
        format_id: 'seed-cad',
        version: '2',
        change_date: '2026-10-06',
        change_reason: 'Control de etapas (Inicio/Proceso/Final), software utilizado y causa raíz de reprocesos.',
        responsible_name: 'Coordinación CAD',
        file_format: 'xlsx',
      },
      {
        id: 'h-cad-1',
        format_id: 'seed-cad',
        version: '1',
        change_date: '2026-08-20',
        change_reason: 'Registro básico de horas hombre y planos generados.',
        responsible_name: 'Líder Dibujo',
        file_format: 'xlsx',
      },
    ],
  },

  // ─── ALMACÉN Y LOGÍSTICA ──────────────────────────────────────────────────
  {
    code: 'FOR-ALM-001',
    name: 'Entrada y Registro de Instrumental en Kárdex',
    process: 'Almacén y Logística',
    form_slug: 'registro-equipo',
    roles_access: ['Almacén', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'warehouse',
    description: 'Ficha técnica de caracterización, serial, marca, estado operativo y calibración metrológica de equipos al ingresar al inventario.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-ALM-001&format=editable',
    history: [
      {
        id: 'h-alm-1',
        format_id: 'seed-alm-1',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Estandarización de ficha de alta de activos e instrumental en kárdex.',
        responsible_name: 'Jefatura de Almacén',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-ALM-002',
    name: 'Acta de Despacho y Custodia de Instrumental',
    process: 'Almacén y Logística',
    form_slug: 'despacho-equipo',
    roles_access: ['Almacén', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'warehouse',
    description: 'Acta formal de entrega y custodia de instrumental asignado a localizadores para comisiones de campo.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-ALM-002&format=editable',
    history: [
      {
        id: 'h-alm-2',
        format_id: 'seed-alm-2',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Emisión oficial de acta de remisión de equipos con verificación de accesorios y firma de recepción.',
        responsible_name: 'Jefatura de Almacén',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-ALM-003',
    name: 'Acta de Retorno y Novedades de Instrumental',
    process: 'Almacén y Logística',
    form_slug: 'retorno-equipo',
    roles_access: ['Almacén', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'warehouse',
    description: 'Acta de recepción física, inspección de estado operativo y reporte de novedades al regresar equipos de campo.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-ALM-003&format=editable',
    history: [
      {
        id: 'h-alm-3',
        format_id: 'seed-alm-3',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Formato oficial de recepción y diagnóstico de reintegro a bodega.',
        responsible_name: 'Jefatura de Almacén',
        file_format: 'docx',
      },
    ],
  },

  // ─── COMPRAS Y ADQUISICIONES ──────────────────────────────────────────────
  {
    code: 'FOR-COM-001',
    name: 'Solicitud de Requerimiento de Compras y Servicios',
    process: 'Compras y Adquisiciones',
    form_slug: 'requerimiento-compra',
    roles_access: ['Todos los Roles'],
    is_universal: true,
    current_version: '2',
    effective_date: '2026-10-02',
    status: 'active',
    category: 'purchasing',
    description: 'Petición formal de insumos, consumibles, herramientas o servicios requeridos por proyectos o áreas.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-COM-001&format=editable',
    history: [
      {
        id: 'h-com-2',
        format_id: 'seed-com-1',
        version: '2',
        change_date: '2026-10-02',
        change_reason: 'Incorporación de imputación por centro de costos, cédula del solicitante y aprobador de proyecto.',
        responsible_name: 'Gerencia Administrativa',
        file_format: 'xlsx',
      },
      {
        id: 'h-com-1',
        format_id: 'seed-com-1',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Formato inicial de requerimiento de compras con lista de ítems.',
        responsible_name: 'Coordinación Compras',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-COM-002',
    name: 'Orden de Compra y Adjudicación de Proveedor',
    process: 'Compras y Adquisiciones',
    form_slug: 'orden-compra',
    roles_access: ['Compras', 'Gerencia', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'purchasing',
    description: 'Documento formal de orden de compra, proveedor adjudicado, condiciones de pago, garantías y montos aprobados.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-COM-002&format=editable',
    history: [
      {
        id: 'h-com-2-1',
        format_id: 'seed-com-2',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Emisión oficial de plantilla de Orden de Compra (OC) vinculante.',
        responsible_name: 'Coordinación Compras',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-COM-003',
    name: 'Evaluación y Calificación de Proveedores',
    process: 'Compras y Adquisiciones',
    form_slug: 'evaluacion-proveedor',
    roles_access: ['Compras', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'purchasing',
    description: 'Matriz de calificación de calidad de bienes, tiempos de entrega y nivel de servicio post-venta.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-COM-003&format=editable',
    history: [
      {
        id: 'h-com-3-1',
        format_id: 'seed-com-3',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Implementación de evaluación periódica de proveedores según estándar ISO 9001.',
        responsible_name: 'Compras / Calidad',
        file_format: 'xlsx',
      },
    ],
  },

  // ─── GESTIÓN COMERCIAL ────────────────────────────────────────────────────
  {
    code: 'FOR-CMR-001',
    name: 'Ficha de Registro de Oportunidad y Licitación',
    process: 'Gestión Comercial',
    form_slug: 'registro-oportunidad',
    roles_access: ['Comercial', 'Gerencia', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'commercial',
    description: 'Captura de requerimientos de clientes, pliegos licitatorios, presupuesto estimado y fechas límite de propuesta.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-CMR-001&format=editable',
    history: [
      {
        id: 'h-cmr-1',
        format_id: 'seed-cmr-1',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Creación del formato de entrada de prospectos y licitaciones al pipeline.',
        responsible_name: 'Dirección Comercial',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-CMR-002',
    name: 'Cotización Comercial y Oferta Económica',
    process: 'Gestión Comercial',
    form_slug: 'cotizacion-comercial',
    roles_access: ['Comercial', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'commercial',
    description: 'Estructura de propuesta económica y técnica presentada al cliente, discriminación de IVA y validez de oferta.',
    editable_type: 'docx',
    has_xlsx: true,
    download_template_url: '/api/tools/version-control/download-template?code=FOR-CMR-002&format=editable',
    history: [
      {
        id: 'h-cmr-2',
        format_id: 'seed-cmr-2',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Estandarización de formato para ofertas comerciales formales.',
        responsible_name: 'Dirección Comercial',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-CMR-003',
    name: 'Acta de Cierre de Negociación y Adjudicación',
    process: 'Gestión Comercial',
    form_slug: 'cierre-comercial',
    roles_access: ['Comercial', 'Gerencia', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'commercial',
    description: 'Registro del desenlace comercial de la oferta: adjudicada, perdida ante competencia o declarada desierta.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-CMR-003&format=editable',
    history: [
      {
        id: 'h-cmr-3',
        format_id: 'seed-cmr-3',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Registro de desenlace contractual y lecciones aprendidas de licitación.',
        responsible_name: 'Dirección Comercial',
        file_format: 'docx',
      },
    ],
  },

  // ─── FINANZAS Y TESORERÍA ─────────────────────────────────────────────────
  {
    code: 'FOR-FIN-001',
    name: 'Solicitud y Autorización de Viáticos y Anticipos',
    process: 'Finanzas y Tesorería',
    form_slug: 'solicitud-viaticos',
    roles_access: ['Todos los Roles'],
    is_universal: true,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'finance',
    description: 'Petición formal de fondos para comisiones de campo, transporte, hospedaje, alimentación y peajes.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-FIN-001&format=editable',
    history: [
      {
        id: 'h-fin-1',
        format_id: 'seed-fin-1',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Estandarización de formato de solicitud de fondos para comisiones técnicas.',
        responsible_name: 'Tesorería',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-FIN-002',
    name: 'Legalización y Rendición de Gastos de Comisión',
    process: 'Finanzas y Tesorería',
    form_slug: 'legalizacion-gastos',
    roles_access: ['Todos los Roles'],
    is_universal: true,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'finance',
    description: 'Rendición pormenorizada de comprobantes de gastos ejecutados contra anticipos recibidos y determinación de saldo.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-FIN-002&format=editable',
    history: [
      {
        id: 'h-fin-2',
        format_id: 'seed-fin-2',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Planilla oficial de legalización de viáticos y soportes tributarios de egreso.',
        responsible_name: 'Tesorería',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-FIN-003',
    name: 'Comprobante de Egreso y Soporte de Pago Bancario',
    process: 'Finanzas y Tesorería',
    form_slug: 'registro-pago',
    roles_access: ['Finanzas', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'finance',
    description: 'Captura de comprobante bancario, transferencias realizadas y soportes contables de desembolso.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-FIN-003&format=editable',
    history: [
      {
        id: 'h-fin-3',
        format_id: 'seed-fin-3',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Formato de comprobante de egreso y transferencia bancaria.',
        responsible_name: 'Tesorería',
        file_format: 'xlsx',
      },
    ],
  },

  // ─── CONTABILIDAD ─────────────────────────────────────────────────────────
  {
    code: 'FOR-CNT-001',
    name: 'Radicación de Factura Proveedor para Causación',
    process: 'Contabilidad',
    form_slug: 'radicacion-factura',
    roles_access: ['Contabilidad', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'accounting',
    description: 'Entrada y registro de facturas de proveedores para trámite de causación, retención en la fuente y pago programado.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-CNT-001&format=editable',
    history: [
      {
        id: 'h-cnt-1',
        format_id: 'seed-cnt-1',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Control contable de radicación de facturas electrónicas.',
        responsible_name: 'Contabilidad',
        file_format: 'xlsx',
      },
    ],
  },
  {
    code: 'FOR-CNT-002',
    name: 'Acta de Corte de Obra y Soporte de Facturación',
    process: 'Contabilidad',
    form_slug: 'soporte-cobro',
    roles_access: ['Contabilidad', 'Gerencia', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'accounting',
    description: 'Registro de corte de obra, metros lineales ejecutados y actas de interventoría aprobadas para facturar al cliente.',
    editable_type: 'xlsx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-CNT-002&format=editable',
    history: [
      {
        id: 'h-cnt-2',
        format_id: 'seed-cnt-2',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Acta formal de entrega parcial o final para radicación de cuenta de cobro / factura al cliente.',
        responsible_name: 'Contabilidad / Gerencia',
        file_format: 'xlsx',
      },
    ],
  },

  // ─── GESTIÓN DEL TALENTO HUMANO (RRHH) ────────────────────────────────────
  {
    code: 'FOR-TH-001',
    name: 'Certificación Laboral',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Acreditación formal de vínculo laboral, cargo, salario devengado, antigüedad y tipo de contrato.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-001&format=editable',
    history: [
      {
        id: 'h-th-1',
        format_id: 'seed-th-1',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Modelo oficial de certificación laboral institucional.',
        responsible_name: 'Talento Humano',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-TH-002',
    name: 'Presentación de Personal en Obra',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Presentación formal de colaboradores ante clientes o interventoría con afiliaciones de seguridad social integral (EPS, ARL, AFP).',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-002&format=editable',
    history: [
      {
        id: 'h-th-2',
        format_id: 'seed-th-2',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Formato de carta de presentación ante interventorías en campo.',
        responsible_name: 'Talento Humano',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-TH-003',
    name: 'Vinculación a Proyecto / Obra',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Asignación oficial a frente de trabajo, condiciones del contrato, jefe inmediato y entrega de dotación/EPP.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-003&format=editable',
    history: [
      {
        id: 'h-th-3',
        format_id: 'seed-th-3',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Modelo oficial de adscripción y asignación de colaboradores a frentes de obra.',
        responsible_name: 'Talento Humano',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-TH-004',
    name: 'Terminación de Contrato de Trabajo',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Comunicación formal de desvinculación laboral, causas legales, liquidación de prestaciones y entrega de cargo.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-004&format=editable',
    history: [
      {
        id: 'h-th-4',
        format_id: 'seed-th-4',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Plantilla legal de notificación de terminación contractual.',
        responsible_name: 'Talento Humano',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-TH-005',
    name: 'Paz y Salvo Laboral',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Constancia de entrega de dotación, EPP, equipos técnicos, herramientas, caja menor y carnet corporativo.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-005&format=editable',
    history: [
      {
        id: 'h-th-5',
        format_id: 'seed-th-5',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Certificado de paz y salvo integral de almacén, finanzas y gerencia.',
        responsible_name: 'Talento Humano',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-TH-006',
    name: 'Permiso Laboral y Licencias',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Autorización y registro de ausencias laborales, citas médicas, calamidad doméstica o licencias temporales.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-006&format=editable',
    history: [
      {
        id: 'h-th-6',
        format_id: 'seed-th-6',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Formato oficial de solicitud y aprobación de permisos laborales.',
        responsible_name: 'Talento Humano',
        file_format: 'docx',
      },
    ],
  },
  {
    code: 'FOR-TH-007',
    name: 'Solicitud a Entidad Externa',
    process: 'Gestión del Talento Humano',
    form_slug: 'elaboracion-cartas',
    roles_access: ['RRHH', 'Admin'],
    is_universal: false,
    current_version: '1',
    effective_date: '2026-09-24',
    status: 'active',
    category: 'rrhh',
    description: 'Oficio formal corporativo dirigido a entidades públicas, clientes o proveedores con representación legal.',
    editable_type: 'docx',
    download_template_url: '/api/tools/version-control/download-template?code=FOR-TH-007&format=editable',
    history: [
      {
        id: 'h-th-7',
        format_id: 'seed-th-7',
        version: '1',
        change_date: '2026-09-24',
        change_reason: 'Estandarización de oficio institucional para terceros.',
        responsible_name: 'Gerencia General',
        file_format: 'docx',
      },
    ],
  },
];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const processFilter = searchParams.get('process') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const searchFilter = (searchParams.get('search') || '').trim().toLowerCase();

    const supabase = createAdminClient();

    let formats: DocumentFormatItem[] = [];

    let tableExists = false;

    // 1. Intentar consultar base de datos Supabase
    try {
      const { data: dbFormats, error: fError } = await supabase
        .from('document_format_versions')
        .select('*')
        .order('process', { ascending: true })
        .order('code', { ascending: true });

      if (!fError && dbFormats) {
        tableExists = true;
        // Cargar historiales asociados concurrentemente
        const { data: dbHistories } = await supabase
          .from('format_version_history')
          .select('*')
          .order('change_date', { ascending: false });

        const historyByFormat = new Map<string, FormatVersionHistoryItem[]>();
        for (const h of dbHistories ?? []) {
          const list = historyByFormat.get(h.format_id) || [];
          list.push(h);
          historyByFormat.set(h.format_id, list);
        }

        formats = dbFormats.map((f) => {
          const hist = historyByFormat.get(f.id) || [];
          const seedMeta = MASTER_FORMATS_SEED.find((s) => s.code === f.code);
          const editableType = (f.category === 'commercial' && f.code !== 'FOR-CMR-002') || f.code.startsWith('FOR-TH') || f.code === 'FOR-ALM-002' || f.code === 'FOR-ALM-003' || f.code === 'FOR-GPR-001' ? 'docx' : (seedMeta?.editable_type || 'xlsx');
          const hasPptx = f.code === 'FOR-GPR-001' || Boolean(seedMeta?.has_pptx);
          const hasXlsx = f.code === 'FOR-CMR-002' || Boolean(seedMeta?.has_xlsx);

          return {
            id: f.id,
            code: f.code,
            name: f.name,
            process: f.process,
            form_slug: f.form_slug || seedMeta?.form_slug || null,
            roles_access: Array.isArray(f.roles_access) ? f.roles_access : [],
            is_universal: Boolean(f.is_universal),
            current_version: f.current_version,
            effective_date: f.effective_date,
            status: f.status,
            category: f.category,
            description: f.description,
            download_template_url: f.download_template_url || `/api/tools/version-control/download-template?code=${f.code}&format=editable`,
            editable_type: (f.editable_type as 'xlsx' | 'docx' | 'pptx') || editableType,
            has_pptx: hasPptx,
            has_xlsx: hasXlsx,
            versions_count: Math.max(1, hist.length),
            history: hist,
          };
        });
      }
    } catch (dbErr) {
      console.warn('Tabla document_format_versions aún no creada o con error en Supabase:', dbErr);
    }

    // Si la tabla aún no existe en Supabase (migración pendiente de ejecutar), usar catálogo en memoria
    if (!tableExists) {
      formats = MASTER_FORMATS_SEED.map((s, idx) => ({
        ...s,
        id: `fmt-${idx + 1}`,
        versions_count: s.history.length,
      }));
    }

    // 2. Aplicar filtros en memoria
    let filtered = [...formats];

    if (processFilter !== 'all') {
      filtered = filtered.filter((f) => f.process === processFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }

    if (searchFilter) {
      filtered = filtered.filter((f) =>
        f.code.toLowerCase().includes(searchFilter) ||
        f.name.toLowerCase().includes(searchFilter) ||
        f.process.toLowerCase().includes(searchFilter) ||
        (f.description && f.description.toLowerCase().includes(searchFilter)) ||
        f.roles_access.some((r) => r.toLowerCase().includes(searchFilter))
      );
    }

    // 3. Extraer procesos únicos para filtros
    const processesSet = new Set<string>();
    formats.forEach((f) => processesSet.add(f.process));
    const processes = Array.from(processesSet).sort();

    // 4. Estadísticas
    const stats = {
      total_formats: formats.length,
      active_formats: formats.filter((f) => f.status === 'active').length,
      total_versions_tracked: formats.reduce((acc, f) => acc + f.versions_count, 0),
      processes_count: processes.length,
      updated_2026_count: formats.filter((f) => f.effective_date.startsWith('2026')).length,
    };

    return NextResponse.json({
      data: filtered,
      processes,
      stats,
      table_exists: tableExists,
      db_count: tableExists ? formats.length : 0,
    });
  } catch (error: unknown) {
    console.error('Error en GET /api/tools/version-control:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al consultar control de versiones' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Validar usuario
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('email', session.user.email)
      .single();

    const allowedRoles = ['admin', 'hseq', 'gerencia', 'management'];
    const isAuthorized = dbUser && (allowedRoles.includes(dbUser.role) || session.user.email.includes('procimec'));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No cuenta con privilegios de HSEQ o Administrador para modificar el control de versiones.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'bump_version') {
      const {
        format_id,
        new_version,
        change_date,
        change_reason,
        responsible_name,
        file_format = 'xlsx',
        file_url,
      } = body;

      if (!format_id || !new_version || !change_date || !change_reason) {
        return NextResponse.json({ error: 'Faltan campos requeridos para incrementar versión.' }, { status: 400 });
      }

      // 1. Determinar tipo editable si se adjuntó archivo
      let normalizedEditable: 'xlsx' | 'docx' | 'pptx' | undefined;
      if (file_format) {
        if (file_format.includes('doc')) normalizedEditable = 'docx';
        else if (file_format.includes('ppt')) normalizedEditable = 'pptx';
        else normalizedEditable = 'xlsx';
      }

      const updateFields: Record<string, any> = {
        current_version: new_version,
        effective_date: change_date,
        updated_at: new Date().toISOString(),
      };
      if (file_url) {
        updateFields.download_template_url = file_url;
      }
      if (normalizedEditable) {
        updateFields.editable_type = normalizedEditable;
      }

      // 2. Actualizar formato principal
      const { data: updatedFormat, error: updateError } = await supabase
        .from('document_format_versions')
        .update(updateFields)
        .eq('id', format_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 3. Insertar historial de versión con archivo adjunto
      const { data: historyItem, error: histError } = await supabase
        .from('format_version_history')
        .insert({
          format_id,
          version: new_version,
          change_date,
          change_reason,
          responsible_name: responsible_name || dbUser?.full_name || 'Responsable HSEQ',
          file_format: file_format || 'xlsx',
          file_url: file_url || null,
        })
        .select()
        .single();

      if (histError) {
        return NextResponse.json({ error: histError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Versión ${new_version} registrada correctamente con su formato editable.`,
        data: { format: updatedFormat, history: historyItem },
      });
    }

    if (action === 'create_format') {
      const {
        code,
        name,
        process,
        form_slug,
        roles_access,
        is_universal,
        current_version,
        effective_date,
        description,
        change_reason,
        file_url,
        file_format = 'xlsx',
      } = body;

      if (!code || !name || !process || !current_version || !effective_date) {
        return NextResponse.json({ error: 'Faltan campos mandatorios para registrar el nuevo formato.' }, { status: 400 });
      }

      let normalizedEditable: 'xlsx' | 'docx' | 'pptx' = 'xlsx';
      if (file_format.includes('doc')) normalizedEditable = 'docx';
      else if (file_format.includes('ppt')) normalizedEditable = 'pptx';

      // 1. Insertar nuevo formato
      const { data: newFmt, error: insertError } = await supabase
        .from('document_format_versions')
        .insert({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          process: process.trim(),
          form_slug: form_slug ? form_slug.trim() : null,
          roles_access: Array.isArray(roles_access) ? roles_access : ['Todos los Roles'],
          is_universal: Boolean(is_universal),
          current_version: current_version.trim(),
          effective_date,
          status: 'active',
          description: description || null,
          download_template_url: file_url || null,
          editable_type: normalizedEditable,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // 2. Registrar versión inicial en historial
      await supabase.from('format_version_history').insert({
        format_id: newFmt.id,
        version: current_version.trim(),
        change_date: effective_date,
        change_reason: change_reason || 'Creación y registro formal del nuevo documento en el listado maestro.',
        responsible_name: dbUser?.full_name || 'Responsable HSEQ',
        file_format: file_format || 'xlsx',
        file_url: file_url || null,
      });

      return NextResponse.json({
        success: true,
        message: `Formato ${newFmt.code} incorporado al listado maestro con versión ${newFmt.current_version}.`,
        data: newFmt,
      });
    }

    if (action === 'edit_format') {
      const {
        id,
        code,
        name,
        process,
        form_slug,
        roles_access,
        is_universal,
        current_version,
        effective_date,
        status = 'active',
        description,
        change_reason,
        file_url,
        file_format,
      } = body;

      if (!id || !code || !name || !process || !current_version || !effective_date) {
        return NextResponse.json({ error: 'Faltan campos mandatorios para modificar el formato.' }, { status: 400 });
      }

      // 1. Obtener formato existente para comparar versión
      const { data: currentFmt } = await supabase
        .from('document_format_versions')
        .select('*')
        .eq('id', id)
        .single();

      const versionChanged = currentFmt && currentFmt.current_version !== current_version.trim();

      const updateFields: Record<string, any> = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        process: process.trim(),
        form_slug: form_slug ? form_slug.trim() : null,
        roles_access: Array.isArray(roles_access) ? roles_access : ['Todos los Roles'],
        is_universal: Boolean(is_universal),
        current_version: current_version.trim(),
        effective_date,
        status,
        description: description || null,
        updated_at: new Date().toISOString(),
      };

      if (file_url) {
        updateFields.download_template_url = file_url;
        if (file_format) {
          updateFields.editable_type = file_format.includes('doc') ? 'docx' : file_format.includes('ppt') ? 'pptx' : 'xlsx';
        }
      }

      // 2. Actualizar datos en PostgreSQL
      const { data: updatedFmt, error: updateError } = await supabase
        .from('document_format_versions')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 3. Si la versión cambió o hay motivo de cambio explícito o se subió archivo, registrar en historial
      if (versionChanged || change_reason || file_url) {
        await supabase.from('format_version_history').insert({
          format_id: id,
          version: current_version.trim(),
          change_date: effective_date,
          change_reason: change_reason || `Actualización del formato a versión ${current_version.trim()}.`,
          responsible_name: dbUser?.full_name || 'Responsable HSEQ',
          file_format: file_format || 'xlsx',
          file_url: file_url || null,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Formato ${updatedFmt.code} modificado correctamente a versión ${updatedFmt.current_version}.`,
        data: updatedFmt,
      });
    }

    if (action === 'seed_master_formats') {
      let insertedCount = 0;
      for (const item of MASTER_FORMATS_SEED) {
        const { data: fmt, error: fErr } = await supabase
          .from('document_format_versions')
          .upsert(
            {
              code: item.code,
              name: item.name,
              process: item.process,
              form_slug: item.form_slug || null,
              roles_access: item.roles_access,
              is_universal: item.is_universal,
              current_version: item.current_version,
              effective_date: item.effective_date,
              status: item.status,
              category: item.category,
              description: item.description || null,
              download_template_url: item.download_template_url || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'code' }
          )
          .select('id')
          .single();

        if (!fErr && fmt?.id) {
          insertedCount++;
          for (const h of item.history) {
            const { data: existingH } = await supabase
              .from('format_version_history')
              .select('id')
              .eq('format_id', fmt.id)
              .eq('version', h.version)
              .maybeSingle();

            if (!existingH) {
              await supabase.from('format_version_history').insert({
                format_id: fmt.id,
                version: h.version,
                change_date: h.change_date,
                change_reason: h.change_reason,
                responsible_name: h.responsible_name,
                file_format: h.file_format || 'xlsx',
              });
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Se sincronizaron exitosamente ${insertedCount} formatos oficiales en PostgreSQL.`,
      });
    }

    if (action === 'delete_format') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Falta ID del formato' }, { status: 400 });

      const { error: delError } = await supabase
        .from('document_format_versions')
        .delete()
        .eq('id', id);

      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Formato eliminado del listado maestro.',
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error en POST /api/tools/version-control:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al procesar versión' },
      { status: 500 }
    );
  }
}
