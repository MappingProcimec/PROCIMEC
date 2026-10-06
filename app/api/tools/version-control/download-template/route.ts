import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  VerticalAlign,
} from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchSigTemplateBuffer, generateSigChangePdf } from '@/lib/sig-templates';
import { createPurchaseRequestPdf } from '@/lib/purchasing/purchaseRequestPdfGenerator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Definición de metadatos de formatos reales y sus archivos asociados
export interface FormatFileDef {
  code: string;
  name: string;
  process: string;
  editableType: 'xlsx' | 'docx' | 'pptx';
  hasPptx?: boolean;
  hasXlsx?: boolean;
  localFilePath?: string;
  formSlug?: string;
}

export const FORMAT_FILES_REGISTRY: Record<string, FormatFileDef> = {
  // ─── HSEQ & SIG ─────────────────────────────────────────────────────────────
  'FOR-SIG-001': {
    code: 'FOR-SIG-001',
    name: 'Análisis y Planificación de Cambios',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'analisis-planificacion-cambios-sig',
  },
  'FOR-HSEQ-024': {
    code: 'FOR-HSEQ-024',
    name: 'Inspección Pre-operacional de Drone',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-025': {
    code: 'FOR-HSEQ-025',
    name: 'Inspección Pre-operacional de Estación Total',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-026': {
    code: 'FOR-HSEQ-026',
    name: 'Inspección Pre-operacional de GPS Diferencial (GNSS)',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-027': {
    code: 'FOR-HSEQ-027',
    name: 'Inspección Pre-operacional de Georadar (GPR)',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-028': {
    code: 'FOR-HSEQ-028',
    name: 'Inspección Pre-operacional de Localizador Electromagnético',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-029': {
    code: 'FOR-HSEQ-029',
    name: 'Inspección Pre-operacional de Vehículo (PESV)',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-001': {
    code: 'FOR-HSEQ-001',
    name: 'Registro de Asistencia Diaria y Preoperacional',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    formSlug: 'hseq-report',
  },

  // ─── OPERACIONES GPR / GEOFÍSICA ──────────────────────────────────────────
  'FOR-GPR-001': {
    code: 'FOR-GPR-001',
    name: 'Reporte Diario de Campo y Exploración GPR',
    process: 'Operaciones GPR / Geofísica',
    editableType: 'docx',
    hasPptx: true,
    formSlug: 'gpr-field-form',
  },

  // ─── INGENIERÍA Y DIBUJO CAD / BIM ────────────────────────────────────────
  'FOR-CAD-001': {
    code: 'FOR-CAD-001',
    name: 'Bitácora de Modelado y Producción CAD / BIM',
    process: 'Ingeniería y Dibujo CAD/BIM',
    editableType: 'xlsx',
    formSlug: 'cad-register-form',
  },

  // ─── ALMACÉN Y LOGÍSTICA ──────────────────────────────────────────────────
  'FOR-ALM-001': {
    code: 'FOR-ALM-001',
    name: 'Entrada y Registro de Instrumental en Kárdex',
    process: 'Almacén y Logística',
    editableType: 'xlsx',
    formSlug: 'registro-equipo',
  },
  'FOR-ALM-002': {
    code: 'FOR-ALM-002',
    name: 'Acta de Despacho y Custodia de Instrumental',
    process: 'Almacén y Logística',
    editableType: 'docx',
    formSlug: 'despacho-equipo',
  },
  'FOR-ALM-003': {
    code: 'FOR-ALM-003',
    name: 'Acta de Retorno y Novedades de Instrumental',
    process: 'Almacén y Logística',
    editableType: 'docx',
    formSlug: 'retorno-equipo',
  },

  // ─── COMPRAS Y ADQUISICIONES ──────────────────────────────────────────────
  'FOR-COM-001': {
    code: 'FOR-COM-001',
    name: 'Solicitud de Requerimiento de Compras y Servicios',
    process: 'Compras y Adquisiciones',
    editableType: 'xlsx',
    formSlug: 'requerimiento-compra',
  },
  'FOR-COM-002': {
    code: 'FOR-COM-002',
    name: 'Orden de Compra y Adjudicación de Proveedor',
    process: 'Compras y Adquisiciones',
    editableType: 'xlsx',
    formSlug: 'orden-compra',
  },
  'FOR-COM-003': {
    code: 'FOR-COM-003',
    name: 'Evaluación y Calificación de Proveedores',
    process: 'Compras y Adquisiciones',
    editableType: 'xlsx',
    formSlug: 'evaluacion-proveedor',
  },

  // ─── GESTIÓN COMERCIAL ────────────────────────────────────────────────────
  'FOR-CMR-001': {
    code: 'FOR-CMR-001',
    name: 'Ficha de Registro de Oportunidad y Licitación',
    process: 'Gestión Comercial',
    editableType: 'docx',
    formSlug: 'registro-oportunidad',
  },
  'FOR-CMR-002': {
    code: 'FOR-CMR-002',
    name: 'Cotización Comercial y Oferta Económica',
    process: 'Gestión Comercial',
    editableType: 'docx',
    hasXlsx: true,
    formSlug: 'cotizacion-comercial',
  },
  'FOR-CMR-003': {
    code: 'FOR-CMR-003',
    name: 'Acta de Cierre de Negociación y Adjudicación',
    process: 'Gestión Comercial',
    editableType: 'docx',
    formSlug: 'cierre-comercial',
  },

  // ─── FINANZAS Y TESORERÍA ─────────────────────────────────────────────────
  'FOR-FIN-001': {
    code: 'FOR-FIN-001',
    name: 'Solicitud y Autorización de Viáticos y Anticipos',
    process: 'Finanzas y Tesorería',
    editableType: 'xlsx',
    formSlug: 'solicitud-viaticos',
  },
  'FOR-FIN-002': {
    code: 'FOR-FIN-002',
    name: 'Legalización y Rendición de Gastos de Comisión',
    process: 'Finanzas y Tesorería',
    editableType: 'xlsx',
    formSlug: 'legalizacion-gastos',
  },
  'FOR-FIN-003': {
    code: 'FOR-FIN-003',
    name: 'Comprobante de Egreso y Pago Bancario',
    process: 'Finanzas y Tesorería',
    editableType: 'xlsx',
    formSlug: 'registro-pago',
  },

  // ─── CONTABILIDAD ─────────────────────────────────────────────────────────
  'FOR-CNT-001': {
    code: 'FOR-CNT-001',
    name: 'Radicación de Factura Proveedor para Causación',
    process: 'Contabilidad',
    editableType: 'xlsx',
    formSlug: 'radicacion-factura',
  },
  'FOR-CNT-002': {
    code: 'FOR-CNT-002',
    name: 'Acta de Corte de Obra y Soporte de Facturación',
    process: 'Contabilidad',
    editableType: 'xlsx',
    formSlug: 'soporte-cobro',
  },

  // ─── TALENTO HUMANO (RRHH) ────────────────────────────────────────────────
  'FOR-TH-001': {
    code: 'FOR-TH-001',
    name: 'Certificación Laboral',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-002': {
    code: 'FOR-TH-002',
    name: 'Presentación de Personal en Obra',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-003': {
    code: 'FOR-TH-003',
    name: 'Vinculación a Proyecto / Obra',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-004': {
    code: 'FOR-TH-004',
    name: 'Terminación de Contrato de Trabajo',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-005': {
    code: 'FOR-TH-005',
    name: 'Paz y Salvo Laboral',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-006': {
    code: 'FOR-TH-006',
    name: 'Permiso Laboral y Licencias',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-007': {
    code: 'FOR-TH-007',
    name: 'Solicitud a Entidad Externa',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    formSlug: 'elaboracion-cartas',
  },
};

// ─── UTILIDADES DE COLUMNA Y ENCABEZADO INSTITUCIONAL EXCEL ──────────────────
function getColLetter(colIdx: number): string {
  let temp = colIdx;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

function renderInstitutionalExcelHeader(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  opts: {
    code: string;
    name: string;
    processName: string;
    version: string;
    effectiveDate: string;
    totalCols: number;
  }
) {
  const { code, name, processName, version, effectiveDate, totalCols } = opts;
  const numCols = Math.max(totalCols, 6);

  // Alturas de filas 1 a 3 para estándar de gestión documental
  ws.getRow(1).height = 25;
  ws.getRow(2).height = 25;
  ws.getRow(3).height = 22;

  // 1. Logo institucional en A1:B3
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const imageId = wb.addImage({
        filename: logoPath,
        extension: 'png',
      });
      ws.addImage(imageId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 140, height: 46 },
      });
    } catch (e) {
      console.warn('Error al incrustar logo en Excel:', e);
    }
  }

  // Celda unificada para logo
  ws.mergeCells('A1:B3');
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

  // 2. Bloque Central: Razón Social y Título del Formato
  const midEndColIdx = numCols - 2;
  const midEndColLetter = getColLetter(midEndColIdx);

  // Fila 1 Central: Razón Social
  ws.mergeCells(`C1:${midEndColLetter}1`);
  const c1 = ws.getCell('C1');
  c1.value = 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD';
  c1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2229' } };
  c1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Fila 2 Central: Título Oficial del Formato
  ws.mergeCells(`C2:${midEndColLetter}2`);
  const c2 = ws.getCell('C2');
  c2.value = `FORMATO: ${name.toUpperCase()}`;
  c2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E2229' } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAA023' } };
  c2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  // Fila 3 Central: Proceso del SIG
  ws.mergeCells(`C3:${midEndColLetter}3`);
  const c3 = ws.getCell('C3');
  c3.value = `PROCESO: ${processName.toUpperCase()}`;
  c3.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF4B5563' } };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  c3.alignment = { vertical: 'middle', horizontal: 'center' };

  // 3. Bloque Derecho: Control Documental (Código, Versión, Fecha)
  const rightStartColLetter = getColLetter(numCols - 1);
  const rightEndColLetter = getColLetter(numCols);

  // Fila 1 Derecha: Código
  ws.mergeCells(`${rightStartColLetter}1:${rightEndColLetter}1`);
  const r1 = ws.getCell(`${rightStartColLetter}1`);
  r1.value = `CÓDIGO: ${code}`;
  r1.font = { name: 'Courier New', size: 9, bold: true, color: { argb: 'FFB45309' } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  r1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Fila 2 Derecha: Versión
  ws.mergeCells(`${rightStartColLetter}2:${rightEndColLetter}2`);
  const r2 = ws.getCell(`${rightStartColLetter}2`);
  const fmtVer = version.toString().padStart(2, '0');
  r2.value = `VERSIÓN: ${fmtVer}`;
  r2.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF1E2229' } };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  r2.alignment = { vertical: 'middle', horizontal: 'center' };

  // Fila 3 Derecha: Fecha del Formato
  ws.mergeCells(`${rightStartColLetter}3:${rightEndColLetter}3`);
  const r3 = ws.getCell(`${rightStartColLetter}3`);
  r3.value = `FECHA: ${effectiveDate}`;
  r3.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF1E2229' } };
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  r3.alignment = { vertical: 'middle', horizontal: 'center' };

  // Bordes técnicos finos para todas las celdas del bloque de encabezado
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= numCols; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  }
}

// ─── GENERADOR DE EXCEL (.xlsx) EXACTO Y FIDEDIGNO PARA CADA FORMATO ─────────
async function generateExcelTemplate(
  code: string,
  name: string,
  processName: string,
  version: string = '01',
  effectiveDate: string = '2026-10-02'
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD';
  wb.created = new Date();

  const ws = wb.addWorksheet(code, {
    views: [{ showGridLines: true }],
  });

  const cellFont = { name: 'Arial', size: 8.5 };
  const cellBoldFont = { name: 'Arial', size: 8.5, bold: true };
  const charcoalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2229' } };
  const amberFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAA023' } };
  const graphiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A303C' } };
  const lightGrayFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

  // ─── 1. FOR-COM-001: SOLICITUD DE REQUERIMIENTO DE COMPRAS Y SERVICIOS ───────
  if (code === 'FOR-COM-001') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 9,
    });

    // Fila 4: Título Sección 1
    ws.addRow([]);
    const rSec1 = ws.addRow(['1. IMPUTACIÓN DE PROYECTO Y CENTRO DE COSTOS', '', '', '', '', '', '', '', '']);
    rSec1.height = 20;
    ws.mergeCells(`A${rSec1.number}:I${rSec1.number}`);
    rSec1.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    rSec1.getCell(1).fill = charcoalFill;
    rSec1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    // Fila 5: Proyecto y Centro de Costo
    const r5 = ws.addRow(['PROYECTO DESTINO:', '', '', 'CENTRO DE COSTO:', '', '', '', '', '']);
    ws.mergeCells(`A${r5.number}:B${r5.number}`);
    ws.mergeCells(`C${r5.number}:E${r5.number}`);
    ws.mergeCells(`F${r5.number}:G${r5.number}`);
    ws.mergeCells(`H${r5.number}:I${r5.number}`);
    r5.getCell(1).value = 'PROYECTO DESTINO:';
    r5.getCell(3).value = 'Operación General / Proyecto Asignado';
    r5.getCell(6).value = 'CENTRO DE COSTO:';
    r5.getCell(8).value = '—';

    // Fila 6: Cliente y Fecha Registro
    const r6 = ws.addRow(['CLIENTE PROYECTO:', '', '', 'FECHA DE REGISTRO:', '', '', '', '', '']);
    ws.mergeCells(`A${r6.number}:B${r6.number}`);
    ws.mergeCells(`C${r6.number}:E${r6.number}`);
    ws.mergeCells(`F${r6.number}:G${r6.number}`);
    ws.mergeCells(`H${r6.number}:I${r6.number}`);
    r6.getCell(1).value = 'CLIENTE PROYECTO:';
    r6.getCell(3).value = 'Cliente Corporativo';
    r6.getCell(6).value = 'FECHA DE REGISTRO:';
    r6.getCell(8).value = effectiveDate;

    // Fila 7: Consecutivo Oficial y Tipo Requerimiento
    const r7 = ws.addRow(['CONSECUTIVO OFICIAL:', '', '', 'TIPO REQUERIMIENTO:', '', '', '', '', '']);
    ws.mergeCells(`A${r7.number}:B${r7.number}`);
    ws.mergeCells(`C${r7.number}:E${r7.number}`);
    ws.mergeCells(`F${r7.number}:G${r7.number}`);
    ws.mergeCells(`H${r7.number}:I${r7.number}`);
    r7.getCell(1).value = 'CONSECUTIVO OFICIAL:';
    r7.getCell(3).value = 'REQ-2026-_____';
    r7.getCell(3).font = { name: 'Courier New', size: 9, bold: true, color: { argb: 'FFB45309' } };
    r7.getCell(6).value = 'TIPO REQUERIMIENTO:';
    r7.getCell(8).value = 'COMPRAS Y SERVICIOS';

    [r5, r6, r7].forEach((r) => {
      r.height = 19;
      r.getCell(1).font = cellBoldFont;
      r.getCell(1).fill = lightGrayFill;
      r.getCell(6).font = cellBoldFont;
      r.getCell(6).fill = lightGrayFill;
      for (let c = 1; c <= 9; c++) {
        r.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    });

    // Fila 8: Título Sección 2
    ws.addRow([]);
    const rSec2 = ws.addRow(['2. RESPONSABLES Y DATOS DE ENTREGA EN SITIO', '', '', '', '', '', '', '', '']);
    rSec2.height = 20;
    ws.mergeCells(`A${rSec2.number}:I${rSec2.number}`);
    rSec2.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    rSec2.getCell(1).fill = charcoalFill;

    // Fila 9: Solicitante y Quien Aprueba
    const r9 = ws.addRow(['SOLICITANTE RESPONSABLE:', '', '', 'QUIEN APRUEBA:', '', '', '', '', '']);
    ws.mergeCells(`A${r9.number}:B${r9.number}`);
    ws.mergeCells(`C${r9.number}:E${r9.number}`);
    ws.mergeCells(`F${r9.number}:G${r9.number}`);
    ws.mergeCells(`H${r9.number}:I${r9.number}`);
    r9.getCell(1).value = 'SOLICITANTE RESPONSABLE:';
    r9.getCell(3).value = 'Líder / Solicitante';
    r9.getCell(6).value = 'QUIEN APRUEBA:';
    r9.getCell(8).value = 'Director / Gerente';

    // Fila 10: Lugar de Entrega y Fecha Requerida
    const r10 = ws.addRow(['LUGAR DE ENTREGA:', '', '', 'FECHA REQUERIDA:', '', '', '', '', '']);
    ws.mergeCells(`A${r10.number}:B${r10.number}`);
    ws.mergeCells(`C${r10.number}:E${r10.number}`);
    ws.mergeCells(`F${r10.number}:G${r10.number}`);
    ws.mergeCells(`H${r10.number}:I${r10.number}`);
    r10.getCell(1).value = 'LUGAR DE ENTREGA:';
    r10.getCell(3).value = 'Bodega Central / Frente de Obra';
    r10.getCell(6).value = 'FECHA REQUERIDA:';
    r10.getCell(8).value = 'Inmediata / Programada';

    [r9, r10].forEach((r) => {
      r.height = 19;
      r.getCell(1).font = cellBoldFont;
      r.getCell(1).fill = lightGrayFill;
      r.getCell(6).font = cellBoldFont;
      r.getCell(6).fill = lightGrayFill;
      for (let c = 1; c <= 9; c++) {
        r.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    });

    // Fila 11: Título Sección 3
    ws.addRow([]);
    const rSec3 = ws.addRow(['3. RELACIÓN DISCRIMINADA DE ÍTEMS Y ESPECIFICACIONES TÉCNICAS', '', '', '', '', '', '', '', '']);
    rSec3.height = 20;
    ws.mergeCells(`A${rSec3.number}:I${rSec3.number}`);
    rSec3.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    rSec3.getCell(1).fill = charcoalFill;

    // Encabezados de Tabla de Ítems
    const rTh = ws.addRow([
      'Ítem',
      'Cant.',
      'Unidad',
      'Descripción Técnica Detallada',
      'Proveedor Sugerido',
      'Moneda',
      'Precio Unitario Est.',
      'Subtotal Est.',
      'Total COP',
    ]);
    rTh.height = 22;
    rTh.eachCell((c) => {
      c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = graphiteFill;
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Filas de Datos de Ítems
    const startItemRow = rTh.number + 1;
    for (let i = 1; i <= 8; i++) {
      const curRow = ws.addRow([i, 1, 'UND', `Insumo / Servicio técnico ítem #${i}`, 'Proveedor Autorizado', 'COP', 0, 0, 0]);
      curRow.height = 19;
      const rNum = curRow.number;
      curRow.getCell(8).value = { formula: `B${rNum}*G${rNum}` };
      curRow.getCell(9).value = { formula: `H${rNum}` };

      curRow.eachCell((c, col) => {
        c.font = cellFont;
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        if (col === 1 || col === 2 || col === 3 || col === 6) {
          c.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        if (col === 7 || col === 8 || col === 9) {
          c.numFmt = '$#,##0';
          c.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }
    const endItemRow = startItemRow + 7;

    // Fila Total
    const rTot = ws.addRow(['TOTAL GENERAL DEL REQUERIMIENTO (COP):', '', '', '', '', '', '', '', '']);
    rTot.height = 22;
    ws.mergeCells(`A${rTot.number}:H${rTot.number}`);
    rTot.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } };
    rTot.getCell(1).fill = amberFill;
    rTot.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    rTot.getCell(9).value = { formula: `SUM(I${startItemRow}:I${endItemRow})` };
    rTot.getCell(9).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E2229' } };
    rTot.getCell(9).fill = amberFill;
    rTot.getCell(9).numFmt = '$#,##0';
    rTot.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

    // Fila 4. Firmas y Aprobaciones (4 Instancias)
    ws.addRow([]);
    const rSec4 = ws.addRow(['4. CONTROL DE FIRMAS, VALIDACIÓN TÉCNICA Y APROBACIONES (4 INSTANCIAS)', '', '', '', '', '', '', '', '']);
    rSec4.height = 20;
    ws.mergeCells(`A${rSec4.number}:I${rSec4.number}`);
    rSec4.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    rSec4.getCell(1).fill = charcoalFill;

    const sH = ws.addRow(['1. SOLICITADO POR', '', '2. APROBADO POR', '', '3. GESTIÓN COMPRAS', '', '', '4. APROBADO GERENCIA', '']);
    sH.height = 18;
    ws.mergeCells(`A${sH.number}:B${sH.number}`);
    ws.mergeCells(`C${sH.number}:D${sH.number}`);
    ws.mergeCells(`E${sH.number}:G${sH.number}`);
    ws.mergeCells(`H${sH.number}:I${sH.number}`);
    [sH.getCell(1), sH.getCell(3), sH.getCell(5), sH.getCell(8)].forEach((c) => {
      c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = graphiteFill;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const sB = ws.addRow(['Firma:\nNombre:\nC.C.:\nFecha:', '', 'Firma:\nNombre:\nCargo:\nFecha:', '', 'Firma:\nCotizaciones:\nProveedor:\nVo.Bo.:', '', '', 'Firma:\nAprobado Gerencia:\nMonto:\nFecha:']);
    sB.height = 50;
    ws.mergeCells(`A${sB.number}:B${sB.number}`);
    ws.mergeCells(`C${sB.number}:D${sB.number}`);
    ws.mergeCells(`E${sB.number}:G${sB.number}`);
    ws.mergeCells(`H${sB.number}:I${sB.number}`);
    [sB.getCell(1), sB.getCell(3), sB.getCell(5), sB.getCell(8)].forEach((c) => {
      c.font = { name: 'Arial', size: 7.5 };
      c.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 8;
    ws.getColumn(3).width = 8;
    ws.getColumn(4).width = 38;
    ws.getColumn(5).width = 15;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 20;
    ws.getColumn(8).width = 14;
    ws.getColumn(9).width = 16;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 2. FOR-COM-002: ORDEN DE COMPRA Y ADJUDICACIÓN ─────────────────────────
  if (code === 'FOR-COM-002') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 7,
    });

    ws.addRow([]);
    const r5 = ws.addRow(['Código de Orden (OC):', 'OC-2026-_____', 'Requerimiento Asociado:', 'REQ-_____', 'Fecha de Emisión:', effectiveDate, '']);
    const r6 = ws.addRow(['Razón Social Proveedor:', '', 'NIT / Identificación:', '', 'Condiciones de Pago:', '[  ] Contado  [  ] Crédito 15d  [  ] Crédito 30d', '']);
    const r7 = ws.addRow(['Fecha Pactada Entrega:', effectiveDate, 'Lugar de Entrega:', 'Bodega Central PROCIMEC', 'Contacto Proveedor:', '', '']);
    [r5, r6, r7].forEach((r) => { r.height = 19; r.getCell(1).font = cellBoldFont; r.getCell(3).font = cellBoldFont; r.getCell(5).font = cellBoldFont; });

    ws.addRow([]);
    const th = ws.addRow(['Ítem', 'Cant.', 'Unidad', 'Descripción del Insumo / Servicio', 'Valor Unitario ($ COP)', 'Subtotal ($ COP)', 'Observaciones']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

    for (let i = 1; i <= 8; i++) {
      const row = ws.addRow([i, '', '', '', '', '', '']);
      row.height = 19;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 5 || col === 6) c.numFmt = '$#,##0';
      });
    }

    const rSub = ws.addRow(['', '', '', '', 'SUBTOTAL:', '', '']);
    const rIva = ws.addRow(['', '', '', '', 'IVA (19%):', '', '']);
    const rTot = ws.addRow(['', '', '', '', 'TOTAL APROBADO (COP):', '', '']);
    [rSub, rIva, rTot].forEach((r) => { r.getCell(5).font = cellBoldFont; r.getCell(6).font = cellBoldFont; r.getCell(6).numFmt = '$#,##0'; });

    ws.addRow([]);
    const sH = ws.addRow(['ELABORÓ (COMPRAS)', '', 'APROBÓ (GERENCIA)', '', 'ACEPTACIÓN (PROVEEDOR)', '', '']);
    sH.height = 18;
    sH.eachCell((c) => { c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = charcoalFill; c.alignment = { horizontal: 'center' }; });
    const sB = ws.addRow(['Firma:\nNombre:\nCargo:', '', 'Firma:\nNombre:\nGerente General', '', 'Firma:\nNombre:\nSello Proveedor:', '', '']);
    sB.height = 45;

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 8;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 38;
    ws.getColumn(5).width = 22;
    ws.getColumn(6).width = 22;
    ws.getColumn(7).width = 24;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 3. FOR-COM-003: EVALUACIÓN Y CALIFICACIÓN DE PROVEEDORES ───────────────
  if (code === 'FOR-COM-003') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 7,
    });

    ws.addRow([]);
    ws.addRow(['Proveedor Evaluado:', '', 'NIT / RUT:', '', 'Fecha Evaluación:', effectiveDate, '']);
    ws.addRow(['Orden de Compra / Factura:', '', 'Bien o Servicio Suministrado:', '', 'Evaluador Responsable:', '', '']);

    ws.addRow([]);
    const th = ws.addRow(['No.', 'Criterio de Evaluación de Proveedor', 'Escala de Calificación', 'Puntaje (1 al 5)', 'Justificación Técnica / Observaciones', '', '']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; });

    const criteria = [
      '1. Calidad del Producto o Servicio (Especificaciones técnicas y cero defectos)',
      '2. Cumplimiento de Plazos de Entrega (En o antes de la fecha pactada)',
      '3. Nivel de Servicio, Garantía y Soporte Post-Venta',
      '4. Competitividad en Precios y Cumplimiento de Condiciones Comerciales',
      '5. Cumplimiento de Normas SST / HSEQ, Embalaje y Documentación Legal',
    ];

    criteria.forEach((crit, i) => {
      const row = ws.addRow([i + 1, crit, '1=Deficiente | 3=Aceptable | 5=Excelente', '', '', '', '']);
      row.height = 22;
      row.getCell(4).font = cellBoldFont;
      row.getCell(4).alignment = { horizontal: 'center' };
    });

    ws.addRow([]);
    ws.addRow(['PUNTAJE PROMEDIO FINAL:', '', '', '', 'VEREDICTO: [  ] Aprobado  [  ] Condicional  [  ] No Recomendado', '', '']);
    ws.addRow([]);
    ws.addRow(['FIRMA EVALUADOR:', '_________________________', '', 'FIRMA COORDINADOR COMPRAS:', '_________________________', '', '']);

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 44;
    ws.getColumn(3).width = 28;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 40;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 4. FOR-CAD-001: BITÁCORA DE MODELADO Y PRODUCCIÓN CAD / BIM ────────────
  if (code === 'FOR-CAD-001') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 8,
    });

    ws.addRow([]);
    ws.addRow(['Proyecto Imputable:', '', 'Centro de Costos:', '', 'Dibujante / Modelador CAD:', '', '']);
    ws.addRow(['Periodo de Producción:', `Desde: ${effectiveDate}`, `Hasta: ${effectiveDate}`, '', 'Coordinador de Dibujo:', '', '']);

    ws.addRow([]);
    const th = ws.addRow(['Fecha', 'Frente / Tramo', 'Software Utilizado', 'Fase de Entrega', 'Horas Invertidas', 'Metros Lineales (ML)', '¿Reproceso? (SI/NO)', 'Causa de Reproceso / Observaciones']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

    for (let i = 1; i <= 12; i++) {
      const row = ws.addRow(['', '', 'Civil 3D / Revit / AutoCAD', 'Preliminar / Final', '', '', 'NO', '']);
      row.height = 19;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 5 || col === 6 || col === 7) c.alignment = { horizontal: 'center' };
      });
    }

    const rTot = ws.addRow(['TOTALES DE JORNADA:', '', '', '', '', '', '', '']);
    rTot.getCell(1).font = cellBoldFont;
    rTot.getCell(5).font = cellBoldFont;
    rTot.getCell(6).font = cellBoldFont;

    ws.addRow([]);
    const sH = ws.addRow(['FIRMA DIBUJANTE / MODELADOR CAD', '', '', 'FIRMA COORDINADOR CAD / BIM', '', '', '', '']);
    sH.height = 18;
    sH.eachCell((c) => { c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = charcoalFill; });
    const sB = ws.addRow(['\n\nFirma: _____________________\nNombre:', '', '', '\n\nFirma: _____________________\nNombre:', '', '', '', '']);
    sB.height = 45;

    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 24;
    ws.getColumn(3).width = 24;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 20;
    ws.getColumn(7).width = 18;
    ws.getColumn(8).width = 34;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 5. FOR-ALM-001: ENTRADA Y REGISTRO DE INSTRUMENTAL EN KÁRDEX ───────────
  if (code === 'FOR-ALM-001') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 8,
    });

    ws.addRow([]);
    ws.addRow(['Responsable de Almacén:', '', 'Fecha de Actualización:', effectiveDate, 'Ubicación Bodega:', 'Bodega Principal Barranquilla', '']);

    ws.addRow([]);
    const th = ws.addRow(['Código / Placa', 'Descripción del Equipo / Instrumental', 'Marca / Modelo', 'Serial de Fábrica', 'Estado Operativo', 'Calibración Vigente', 'Custodio Actual', 'Ubicación Física']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

    const sampleEquipos = [
      ['EQ-GPR-001', 'Georadar GPR Akula 9000 con Antena 500MHz', 'Geoscanners', 'AK-99214', 'OPERATIVO', 'VIGENTE', 'Almacén Central', 'Estante A1'],
      ['EQ-GPS-002', 'Receptor GNSS RTK Base y Rover i73+', 'CHCNAV', 'GNSS-8812', 'OPERATIVO', 'VIGENTE', 'Frente de Obra', 'Maletín M1'],
      ['EQ-LOC-003', 'Localizador de Tuberías y Cables vLoc3-Pro', 'Vivax-Metrotech', 'VX-4421', 'OPERATIVO', 'VIGENTE', 'Almacén Central', 'Estante B2'],
      ['EQ-ET-004', 'Estación Total Electrónica TS07 5"', 'Leica Geosystems', 'LC-77124', 'OPERATIVO', 'VIGENTE', 'Almacén Central', 'Maletín M2'],
      ['EQ-DRN-005', 'Drone DJI Mavic 3 Enterprise RTK', 'DJI', 'DJ-33120', 'OPERATIVO', 'VIGENTE', 'Almacén Central', 'Caja Pelicase'],
    ];

    sampleEquipos.forEach((eq) => {
      const row = ws.addRow(eq);
      row.height = 20;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 1 || col === 5 || col === 6) c.alignment = { horizontal: 'center' };
      });
    });

    ws.addRow([]);
    ws.addRow(['RESPONSABLE KÁRDEX:', '_________________________', '', 'SUPERVISOR DE OPERACIONES:', '_________________________', '', '', '']);

    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 40;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 22;
    ws.getColumn(8).width = 20;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 6. FOR-FIN-001: SOLICITUD Y AUTORIZACIÓN DE VIÁTICOS Y ANTICIPOS ────────
  if (code === 'FOR-FIN-001') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 8,
    });

    ws.addRow([]);
    ws.addRow(['Colaborador Solicitante:', '', 'Cédula de Ciudadanía:', '', 'Cargo en la Empresa:', '', '']);
    ws.addRow(['Proyecto / Imputación:', '', 'Centro de Costos:', '', 'Fecha Solicitud:', effectiveDate, '']);
    ws.addRow(['Destino de la Comisión:', '', 'Días de Comisión:', '', 'Fecha Inicio / Retorno:', 'Desde: ___ Hasta: ___', '']);

    ws.addRow([]);
    const th = ws.addRow(['Ítem', 'Rubro de Viáticos Solicitado', 'Días / Cant.', 'Valor Diario ($ COP)', 'Subtotal Solicitado ($ COP)', 'Aprobado ($ COP)', 'Observaciones']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; });

    const rubros = [
      '1. Hospedaje y Alojamiento en Sitio de Obra',
      '2. Alimentación Completa (Desayuno, Almuerzo, Cena)',
      '3. Transporte Terrestre / Peajes / Combustible de Vehículo',
      '4. Pasajes Intermunicipales / Taxis Locales Autorizados',
      '5. Gastos Operativos Menores / Hidratación de Campo',
    ];

    rubros.forEach((r, idx) => {
      const row = ws.addRow([idx + 1, r, '', '', '', '', '']);
      row.height = 20;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col >= 4 && col <= 6) c.numFmt = '$#,##0';
      });
    });

    const rTot = ws.addRow(['TOTAL ANTICIPO SOLICITADO:', '', '', '', '', '', '']);
    rTot.getCell(1).font = cellBoldFont;
    rTot.getCell(5).font = cellBoldFont;
    rTot.getCell(6).font = cellBoldFont;

    ws.addRow([]);
    ws.addRow(['FIRMA COLABORADOR SOLICITANTE:', '_________________________', '', 'FIRMA DIRECCIÓN / GERENCIA:', '_________________________', '', '']);

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 46;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 24;
    ws.getColumn(6).width = 24;
    ws.getColumn(7).width = 28;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 7. FOR-FIN-002: LEGALIZACIÓN DE GASTOS DE VIAJE Y CAJA MENOR ────────────
  if (code === 'FOR-FIN-002') {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 8,
    });

    ws.addRow([]);
    ws.addRow(['Colaborador Responsable:', '', 'Cédula:', '', 'Proyecto Imputable:', '', 'Centro de Costos:', '']);
    ws.addRow(['Valor Anticipo Recibido ($):', '', 'Fecha Legalización:', effectiveDate, 'Periodo Legalizado:', 'Desde: ___ Hasta: ___', '', '']);

    ws.addRow([]);
    const th = ws.addRow(['No.', 'Fecha Factura', 'NIT / Proveedor', 'No. Factura / RUT', 'Concepto / Descripción del Gasto', 'Valor Pagado ($ COP)', 'Soporte Físico / Digital', 'Vo.Bo.']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; });

    for (let i = 1; i <= 10; i++) {
      const row = ws.addRow([i, '', '', '', '', '', '[  ] SÍ  [  ] NO', '']);
      row.height = 19;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 6) c.numFmt = '$#,##0';
      });
    }

    const rTot = ws.addRow(['TOTAL GASTOS LEGALIZADOS:', '', '', '', '', '', '', '']);
    const rSal = ws.addRow(['SALDO A FAVOR / EN CONTRA:', '', '', '', '', '', '', '']);
    [rTot, rSal].forEach((r) => { r.getCell(1).font = cellBoldFont; r.getCell(6).font = cellBoldFont; r.getCell(6).numFmt = '$#,##0'; });

    ws.addRow([]);
    ws.addRow(['FIRMA COLABORADOR:', '_________________________', '', 'REVISÓ AUDITORÍA / CONTABILIDAD:', '_________________________', '', '', '']);

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 24;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 28;
    ws.getColumn(6).width = 16;
    ws.getColumn(7).width = 30;
    ws.getColumn(8).width = 22;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 8. HSEQ PRE-OPERACIONALES: CHECKLISTS TÉCNICOS DETALLADOS ──────────────
  if (code.startsWith('FOR-HSEQ')) {
    renderInstitutionalExcelHeader(ws, wb, {
      code,
      name,
      processName,
      version,
      effectiveDate,
      totalCols: 6,
    });

    ws.addRow([]);
    ws.addRow(['Proyecto / Frente de Obra:', '', 'Fecha de Inspección:', effectiveDate, 'Hora de Inicio:', '__ : __']);
    ws.addRow(['Equipo / Instrumental:', name.replace('Inspección Pre-operacional de ', ''), 'Marca / Modelo:', '', 'Serial del Equipo:', '']);
    ws.addRow(['Operador / Localizador:', '', 'Cédula de Ciudadanía:', '', 'Coordinador HSEQ:', '']);

    ws.addRow([]);
    const th = ws.addRow(['Ítem', 'Sistema / Componente Inspeccionado', 'CUMPLE', 'NO CUMPLE', 'N/A', 'Observaciones Técnicas y Hallazgos']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

    let itemsToRender: string[] = [
      '1. Estado físico exterior y estructura libre de grietas o impactos',
      '2. Encendido normal y verificación de indicadores de señal y batería',
      '3. Conectores, puertos y cableado libres de empalmes o desgaste',
      '4. Calibración y respuesta funcional de sensores / antenas',
      '5. Limpieza general y almacenamiento en maletín de protección',
      '6. Protocolos de seguridad HSEQ y uso de EPP de frente',
    ];

    if (code === 'FOR-HSEQ-024') {
      itemsToRender = [
        '1. Fuselaje, brazos mecánicos y hélices libres de fisuras o holguras',
        '2. Baterías de vuelo inteligentes: Carga al 100%, sin hinchazón',
        '3. Control remoto: Joysticks, antenas y nivel de carga verificado',
        '4. Gimbal y cámara: Movimiento libre, calibración de horizonte y lente limpio',
        '5. Sensores de posicionamiento visual y anticolisión limpios y calibrados',
        '6. Tarjeta MicroSD insertada, formateada y con espacio disponible',
        '7. Software / App de vuelo actualizada, enlace con satélites GPS activo',
        '8. Área de despegue / aterrizaje despejada, conos y protocolo PESV / HSEQ',
      ];
    } else if (code === 'FOR-HSEQ-025') {
      itemsToRender = [
        '1. Lentes objetivo y ocular limpios, sin polvo ni rayas internas',
        '2. Niveles tubular y esférico centrados y calibrados con precisión',
        '3. Tornillos de movimiento horizontal y vertical suaves y sin trabas',
        '4. Trípode: Patas, abrazaderas, mariposas y regatones firmes',
        '5. Base nivelante (Tribrach): Plomada óptica o láser verificada',
        '6. Prisma, porta-prisma y jalón: Ojo de pollo nivelado y prisma limpio',
        '7. Baterías y cargador: Carga completa y terminales limpios',
        '8. Memoria interna y puerto de descarga de datos operativos',
      ];
    } else if (code === 'FOR-HSEQ-026') {
      itemsToRender = [
        '1. Receptor Base RTK: Antena, conector y recepción de satélites',
        '2. Receptor Rover: Carcasa, burbuja de nivel y bastón de fibra',
        '3. Colectora de Datos: Pantalla táctil, software y conexión Bluetooth',
        '4. Baterías y Cargadores: Carga completa y terminales limpios',
        '5. Trípode y Base Nivelante: Tornillos de fijación y plomada óptica',
        '6. Radio Enlace / Mástil: Antena UHF y cables de transmisión',
      ];
    } else if (code === 'FOR-HSEQ-027') {
      itemsToRender = [
        '1. Unidad de Control Akula 9000: Encendido, pantalla y puertos',
        '2. Antena GPR: Superficie inferior libre de fisuras o desgaste excesivo',
        '3. Odómetro / Rueda de Medición: Calibración de pulsos y fijación',
        '4. Cable de Datos Antena-Unidad: Conectores sin pines doblados',
        '5. Computadora / Tablet de Adquisición: Batería y software operativo',
        '6. Carrito / Chasis de Transporte: Ruedas, frenos y estructura',
      ];
    } else if (code === 'FOR-HSEQ-028') {
      itemsToRender = [
        '1. Transmisor (TX): Encendido, selección de frecuencia y sonido',
        '2. Receptor (RX): Pantalla gráfica, altavoz y control de ganancia',
        '3. Pinzas de Inducción: Aislamiento eléctrico y mordazas limpias',
        '4. Cables de Conexión Directa: Caimanes y varilla de polo a tierra',
        '5. Pilas / Baterías: Nivel de carga suficiente para la jornada',
      ];
    } else if (code === 'FOR-HSEQ-029') {
      itemsToRender = [
        '1. Documentos: Licencia de Conducción, SOAT y Tecnomecánica vigentes',
        '2. Sistema de Luces: Altas, bajas, direccionales, freno y reversa',
        '3. Frenos y Dirección: Nivel de líquido, freno de mano y respuesta',
        '4. Llantas: Presión de aire, labrado mínimo y llanta de repuesto',
        '5. Fluidos: Aceite de motor, refrigerante y líquido limpiaparabrisas',
        '6. Equipo de Prevención: Botiquín, extintor vigente, conos y tacos',
        '7. Cinturones de Seguridad y Espejos Retrovisores en buen estado',
      ];
    }

    itemsToRender.forEach((desc, idx) => {
      const row = ws.addRow([idx + 1, desc, '[   ]', '[   ]', '[   ]', '']);
      row.height = 20;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 1 || col === 3 || col === 4 || col === 5) c.alignment = { horizontal: 'center' };
      });
    });

    ws.addRow([]);
    const sH = ws.addRow(['OPERADOR / INSPECTOR RESPONSABLE', '', 'COORDINADOR HSEQ', '', 'DIRECCIÓN OPERATIVA', '']);
    sH.height = 18;
    sH.eachCell((c) => { c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = charcoalFill; });
    const sB = ws.addRow(['Firma:\nNombre:\nC.C.:', '', 'Firma:\nNombre:\nLicencia SST:', '', 'Firma:\nNombre:\nCargo:', '']);
    sB.height = 45;

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 46;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 36;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 9. FORMATO EXCEL POR DEFECTO PARA CUALQUIER OTRO MÓDULO ───────────────
  renderInstitutionalExcelHeader(ws, wb, {
    code,
    name,
    processName,
    version,
    effectiveDate,
    totalCols: 6,
  });

  ws.addRow([]);
  ws.addRow(['Proyecto / Frente de Trabajo:', '', 'Fecha de Registro:', effectiveDate, 'Responsable:', '']);
  ws.addRow([]);
  const th = ws.addRow(['Ítem', 'Parámetro / Descripción Operacional', 'Unidad / Ref', 'Cantidad / Valor', 'Estado / Cumplimiento', 'Observaciones Técnicas']);
  th.height = 22;
  th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

  for (let i = 1; i <= 10; i++) {
    const row = ws.addRow([i, '', '', '', '[  ] CONFORME   [  ] NO CONFORME', '']);
    row.height = 19;
    row.eachCell((c, col) => {
      c.font = cellFont;
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      if (col === 1 || col === 5) c.alignment = { horizontal: 'center' };
    });
  }

  ws.addRow([]);
  const sH = ws.addRow(['ELABORÓ (RESPONSABLE)', '', 'REVISÓ (HSEQ)', '', 'APROBÓ (DIRECCIÓN)', '']);
  sH.height = 18;
  sH.eachCell((c) => { c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = charcoalFill; });
  const sB = ws.addRow(['Firma:\nNombre:\nC.C.:', '', 'Firma:\nNombre:\nCargo:', '', 'Firma:\nNombre:\nCargo:', '']);
  sB.height = 45;

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 24;
  ws.getColumn(6).width = 30;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── GENERADOR DE WORD (.docx) FIDEDIGNO Y OFICIAL ───────────────────────────
async function generateDocxTemplate(
  code: string,
  name: string,
  processName: string,
  version: string = '01',
  effectiveDate: string = '2026-10-02'
): Promise<Buffer> {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  let logoRun: ImageRun | TextRun;
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuf = fs.readFileSync(logoPath);
      logoRun = new ImageRun({
        data: logoBuf,
        transformation: { width: 130, height: 38 },
        type: 'png',
      });
    } catch {
      logoRun = new TextRun({ text: 'PROCIMEC', bold: true, size: 20 });
    }
  } else {
    logoRun = new TextRun({ text: 'PROCIMEC', bold: true, size: 20 });
  }

  const fmtVer = version.toString().padStart(2, '0');

  // Encabezado institucional de 3 columnas (Logo, Título/Proceso, Código/Versión/Fecha)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // Columna 1: Logo de la empresa
          new TableCell({
            width: { size: 26, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [logoRun],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'PROCIMEC INGENIERÍA S.A.S.', bold: true, size: 14, color: '1E2229' }),
                ],
              }),
            ],
          }),
          // Columna 2: Título del Formato y Proceso
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'SISTEMA INTEGRADO DE GESTIÓN (SIG)', bold: true, size: 14, color: '64748B' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: name.toUpperCase(), bold: true, size: 18, color: '1E2229' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `PROCESO: ${processName.toUpperCase()}`, size: 14, color: '4B5563' }),
                ],
              }),
            ],
          }),
          // Columna 3: Código, Versión, Fecha y Estado
          new TableCell({
            width: { size: 26, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'CÓDIGO: ', bold: true, size: 15 }),
                  new TextRun({ text: code, size: 15, bold: true, color: 'B45309' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'VERSIÓN: ', bold: true, size: 15 }),
                  new TextRun({ text: fmtVer, size: 15 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'FECHA: ', bold: true, size: 15 }),
                  new TextRun({ text: effectiveDate, size: 15 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'ESTADO: ', bold: true, size: 15 }),
                  new TextRun({ text: 'VIGENTE', size: 15, bold: true, color: '059669' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    headerTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
  ];

  // Si es un formato de Recursos Humanos (Cartas laborales oficiales)
  if (code.startsWith('FOR-TH-')) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `Barranquilla / Bogotá D.C., ${effectiveDate}`, size: 20 }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Radicado Oficial: TH-2026-_____', bold: true, size: 20 }),
        ],
        spacing: { after: 180 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `ASUNTO: ${name.toUpperCase()}`, bold: true, size: 22, color: '1E2229' }),
        ],
        spacing: { after: 220 },
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: `La empresa PROCIMEC INGENIERÍA S.A.S., identificada con NIT 802019658-9, a través del área de ${processName}, emite el presente documento oficial en relación a: ${name}.`,
            size: 21,
          }),
        ],
        spacing: { after: 140, line: 276 },
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: 'Se deja constancia del cumplimiento de los requisitos legales, contractuales y de Sistema Integrado de Gestión aplicables conforme a los registros archivados en la plataforma PCM CLOUD.',
            size: 21,
          }),
        ],
        spacing: { after: 280, line: 276 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'EMITIDO POR:\n\n\n___________________________\nFirma: Gestión del Talento Humano\nPROCIMEC INGENIERÍA S.A.S.', bold: true }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'RECIBIDO / NOTIFICADO:\n\n\n___________________________\nFirma Colaborador(a):\nC.C.:\nFecha:', bold: true }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  } else {
    // Estructura operativa genérica para Word
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '1. INFORMACIÓN GENERAL DEL REGISTRO', bold: true, size: 22, color: '1E2229' }),
        ],
      }),
      new Paragraph({ text: `Fecha de Diligenciamiento: ${effectiveDate}` }),
      new Paragraph({ text: 'Proyecto / Frente de Obra: ___________________________________' }),
      new Paragraph({ text: 'Responsable Operativo: _______________________________________' }),
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({
        children: [
          new TextRun({ text: '2. DETALLE OPERACIONAL Y REGISTRO TÉCNICO', bold: true, size: 22, color: '1E2229' }),
        ],
      }),
      new Paragraph({
        text: code === 'FOR-GPR-001'
          ? 'Parámetros GPR: Frecuencia Antena: ________ MHz | Unidad de Control: Akula 9000 | Ventana de Tiempo: ____ ns | Metros Lineales Totales: ______ ML'
          : code === 'FOR-ALM-002'
          ? 'Acta de Custodia: Se entrega el instrumental técnico relacionado para su operación en campo bajo responsabilidad exclusiva del receptor.'
          : code === 'FOR-ALM-003'
          ? 'Acta de Retorno: Se inspecciona y recibe el instrumental devuelto, certificando su estado de conservación y novedades.'
          : 'Diligencie a continuación los parámetros técnicos y observaciones pertinentes:',
      }),
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ítem', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Descripción / Actividad', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Estado / Serial', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Observaciones', bold: true })] })] }),
            ],
          }),
          ...[1, 2, 3, 4, 5, 6].map((i) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: `${i}` })] }),
                new TableCell({ children: [new Paragraph({ text: '' })] }),
                new TableCell({ children: [new Paragraph({ text: '' })] }),
                new TableCell({ children: [new Paragraph({ text: '' })] }),
              ],
            })
          ),
        ],
      }),
      new Paragraph({ text: '', spacing: { after: 300 } }),
      new Paragraph({
        children: [
          new TextRun({ text: '3. AVAL Y FIRMAS DE CONFORMIDAD', bold: true, size: 22, color: '1E2229' }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'RESPONSABLE QUE ELABORA\n\n\n___________________________\nFirma:\nNombre:\nC.C.:', bold: true })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'REVISIÓN / APROBACIÓN\n\n\n___________________________\nFirma:\nNombre:\nCargo:', bold: true })] }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ─── GENERADOR DE POWERPOINT (.pptx) PARA GPR ────────────────────────────────
async function generatePptxTemplate(
  code: string,
  name: string,
  version: string = '01',
  effectiveDate: string = '2026-10-02'
): Promise<Buffer> {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_16x9';

  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const fmtVer = version.toString().padStart(2, '0');

  // Diapositiva 1: Portada institucional carbón técnico
  const slide1 = pptx.addSlide();
  slide1.addShape(pptx.ShapeType?.rect || 'rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: '1E2229' },
  });

  if (fs.existsSync(logoPath)) {
    slide1.addImage({
      path: logoPath,
      x: 0.8,
      y: 0.8,
      w: 2.2,
      h: 0.63,
    });
  }

  slide1.addText('PROCIMEC INGENIERÍA S.A.S.', {
    x: 0.8,
    y: 1.8,
    fontSize: 24,
    bold: true,
    color: 'FFFFFF',
  });
  slide1.addText(name.toUpperCase(), {
    x: 0.8,
    y: 2.6,
    fontSize: 18,
    bold: true,
    color: 'EAA023',
  });
  slide1.addText(`CÓDIGO: ${code}   |   VERSIÓN: ${fmtVer}   |   FECHA: ${effectiveDate}   |   ESTADO: VIGENTE`, {
    x: 0.8,
    y: 3.4,
    fontSize: 12,
    color: 'CCCCCC',
  });
  slide1.addText('Plantilla Oficial de Presentación de Radargramas, Frentes de Obra y Análisis Geofísico', {
    x: 0.8,
    y: 4.1,
    fontSize: 11,
    italic: true,
    color: '9CA3AF',
  });

  // Diapositiva 2: Lámina Técnica de Radargrama
  const slide2 = pptx.addSlide();
  slide2.addShape(pptx.ShapeType?.rect || 'rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.75,
    fill: { color: '1E2229' },
  });

  if (fs.existsSync(logoPath)) {
    slide2.addImage({
      path: logoPath,
      x: 0.4,
      y: 0.12,
      w: 1.3,
      h: 0.38,
    });
  }

  slide2.addText(`${name.toUpperCase()}  |  ${code}  |  v${fmtVer}  |  ${effectiveDate}`, {
    x: 1.9,
    y: 0.18,
    fontSize: 11,
    bold: true,
    color: 'FFFFFF',
  });

  slide2.addShape(pptx.ShapeType?.rect || 'rect', {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    h: 5.0,
    fill: { color: 'F8FAFC' },
    line: { color: '2A303C', width: 1.5 },
  });
  slide2.addText('[ Inserte aquí el radargrama procesado (.jpg / .png) con escala de tiempo/profundidad ]', {
    x: 1.0,
    y: 3.2,
    fontSize: 12,
    italic: true,
    color: '666666',
    align: 'center',
    w: 8.0,
  });

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

// ─── CONTROLADOR PRINCIPAL DE DESCARGA ────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const userEmail = session?.user?.email || token?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('code') || 'FOR-SIG-001').toUpperCase().trim();
    const reqFormat = (searchParams.get('format') || 'editable').toLowerCase();
    const versionParam = searchParams.get('version')?.trim();

    const meta = FORMAT_FILES_REGISTRY[code] || {
      code,
      name: `Formato ${code}`,
      process: 'Operaciones',
      editableType: 'xlsx' as const,
    };

    let activeVersion = '01';
    let activeEffectiveDate = '2026-10-02';
    let formatTitle = meta.name;
    let formatProcess = meta.process;
    let targetFileUrl: string | null = null;

    // ──────────────────────────────────────────────────────────────────────────
    // CONSULTA DE METADATOS Y ARCHIVO EN SUPABASE POSTGRESQL
    // ──────────────────────────────────────────────────────────────────────────
    try {
      const supabase = createAdminClient();

      const { data: fmtRecord } = await supabase
        .from('document_format_versions')
        .select('id, name, process, current_version, effective_date, download_template_url')
        .eq('code', code)
        .maybeSingle();

      if (fmtRecord) {
        if (fmtRecord.name) formatTitle = fmtRecord.name;
        if (fmtRecord.process) formatProcess = fmtRecord.process;
        if (fmtRecord.current_version) activeVersion = String(fmtRecord.current_version);
        if (fmtRecord.effective_date) activeEffectiveDate = String(fmtRecord.effective_date);

        // Si hay una plantilla explícitamente subida a Supabase Storage
        if (fmtRecord.download_template_url && !fmtRecord.download_template_url.includes('download-template?')) {
          targetFileUrl = fmtRecord.download_template_url;
        }

        // Si se pide una versión histórica específica
        if (versionParam && fmtRecord.id) {
          const { data: histRecord } = await supabase
            .from('format_version_history')
            .select('version, change_date, file_url')
            .eq('format_id', fmtRecord.id)
            .eq('version', versionParam)
            .maybeSingle();

          if (histRecord) {
            activeVersion = String(histRecord.version);
            if (histRecord.change_date) activeEffectiveDate = String(histRecord.change_date);
            if (histRecord.file_url) targetFileUrl = histRecord.file_url;
          } else {
            activeVersion = versionParam;
          }
        }
      }
    } catch (dbErr) {
      console.warn('Error al verificar archivo adjunto en BD:', dbErr);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 1: SERVIR ARCHIVO ADJUNTO EN STORAGE O CARPETA LOCAL DE UPLOADS
    // ──────────────────────────────────────────────────────────────────────────
    if (targetFileUrl) {
      if (targetFileUrl.startsWith('/templates/uploads/')) {
        const localFilePath = path.join(process.cwd(), 'public', targetFileUrl);
        if (fs.existsSync(localFilePath)) {
          const fileBuf = fs.readFileSync(localFilePath);
          const ext = path.extname(localFilePath).toLowerCase();
          const contentType =
            ext === '.xlsx'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : ext === '.docx'
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : ext === '.pptx'
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : 'application/octet-stream';

          return new NextResponse(new Uint8Array(fileBuf), {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${code}_v${activeVersion}${ext}"`,
            },
          });
        }
      }

      if (targetFileUrl.startsWith('http://') || targetFileUrl.startsWith('https://')) {
        try {
          const remoteRes = await fetch(targetFileUrl);
          if (remoteRes.ok) {
            const remoteBuf = await remoteRes.arrayBuffer();
            const ext = path.extname(new URL(targetFileUrl).pathname).toLowerCase() || '.xlsx';
            const contentType =
              ext === '.xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : ext === '.docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : ext === '.pptx'
                ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                : 'application/octet-stream';

            return new NextResponse(new Uint8Array(remoteBuf), {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${code}_v${activeVersion}${ext}"`,
              },
            });
          }
        } catch (fetchErr) {
          console.warn('Error al obtener archivo remoto de storage:', fetchErr);
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 2: POWERPOINT (.pptx)
    // ──────────────────────────────────────────────────────────────────────────
    if (reqFormat === 'pptx' || meta.editableType === 'pptx') {
      const pptxBuf = await generatePptxTemplate(code, formatTitle, activeVersion, activeEffectiveDate);
      return new NextResponse(new Uint8Array(pptxBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${code}_v${activeVersion}_Plantilla_Presentacion.pptx"`,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 3: WORD (.docx)
    // ──────────────────────────────────────────────────────────────────────────
    if (reqFormat === 'docx' || (meta.editableType === 'docx' && reqFormat !== 'xlsx')) {
      const docxBuf = await generateDocxTemplate(code, formatTitle, formatProcess, activeVersion, activeEffectiveDate);
      return new NextResponse(new Uint8Array(docxBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${code}_v${activeVersion}_Plantilla_Oficial.docx"`,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 4: EXCEL (.xlsx)
    // ──────────────────────────────────────────────────────────────────────────
    // Si es FOR-SIG-001, usar plantilla viva de Google Drive con fallback a generador local
    if (code === 'FOR-SIG-001') {
      try {
        const sigExcelBuf = await fetchSigTemplateBuffer();
        return new NextResponse(new Uint8Array(sigExcelBuf), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="FOR-SIG-001_v${activeVersion}_Analisis_Planificacion_Cambios.xlsx"`,
          },
        });
      } catch (driveErr) {
        console.warn('Error al obtener plantilla de Drive para SIG, usando generador oficial:', driveErr);
      }
    }

    const xlsxBuf = await generateExcelTemplate(code, formatTitle, formatProcess, activeVersion, activeEffectiveDate);
    return new NextResponse(new Uint8Array(xlsxBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${code}_v${activeVersion}_Plantilla_Oficial.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error al descargar plantilla:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al procesar plantilla' },
      { status: 500 }
    );
  }
}
