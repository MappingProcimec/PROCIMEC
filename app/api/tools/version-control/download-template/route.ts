import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
    localFilePath: 'public/templates/FOR-Inspección pre-operacional Drone.xlsx',
    formSlug: 'hseq-report',
  },
  'FOR-HSEQ-025': {
    code: 'FOR-HSEQ-025',
    name: 'Inspección Pre-operacional de Estación Total',
    process: 'HSEQ & SIG',
    editableType: 'xlsx',
    localFilePath: 'public/templates/FOR-Inspección pre-operacional Estación Total.xlsx',
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
    localFilePath: 'public/templates/letters/01_Certificacion_Laboral.docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-002': {
    code: 'FOR-TH-002',
    name: 'Presentación de Personal en Obra',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    localFilePath: 'public/templates/letters/02_Presentacion_Personal_Obra.docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-003': {
    code: 'FOR-TH-003',
    name: 'Vinculación a Proyecto / Obra',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    localFilePath: 'public/templates/letters/03_Vinculacion_a_Proyecto.docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-004': {
    code: 'FOR-TH-004',
    name: 'Terminación de Contrato de Trabajo',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    localFilePath: 'public/templates/letters/04_Terminacion_Contrato.docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-005': {
    code: 'FOR-TH-005',
    name: 'Paz y Salvo Laboral',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    localFilePath: 'public/templates/letters/05_Paz_y_Salvo.docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-006': {
    code: 'FOR-TH-006',
    name: 'Permiso Laboral y Licencias',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    localFilePath: 'public/templates/letters/06_Permiso_Laboral.docx',
    formSlug: 'elaboracion-cartas',
  },
  'FOR-TH-007': {
    code: 'FOR-TH-007',
    name: 'Solicitud a Entidad Externa',
    process: 'Gestión del Talento Humano',
    editableType: 'docx',
    localFilePath: 'public/templates/letters/07_Solicitud_Entidad_Externa.docx',
    formSlug: 'elaboracion-cartas',
  },
};

// ─── GENERADOR DE EXCEL (.xlsx) EXACTO Y FIDEDIGNO PARA CADA FORMATO ─────────
async function generateExcelTemplate(code: string, name: string, processName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD';
  wb.created = new Date();

  const ws = wb.addWorksheet(code, {
    views: [{ showGridLines: true }],
  });

  // Estilos de ayuda
  const headerFont = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  const subHeaderFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E2229' } };
  const cellFont = { name: 'Arial', size: 8.5 };
  const cellBoldFont = { name: 'Arial', size: 8.5, bold: true };
  const charcoalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2229' } };
  const amberFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAA023' } };
  const graphiteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A303C' } };
  const lightGrayFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

  // Fila 1: Encabezado corporativo institucional
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD';
  ws.getCell('A1').font = headerFont;
  ws.getCell('A1').fill = charcoalFill;
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 26;

  // Fila 2: Título del Formato
  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `FORMATO OFICIAL: ${name.toUpperCase()} (${code})`;
  ws.getCell('A2').font = subHeaderFont;
  ws.getCell('A2').fill = amberFill;
  ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  // Fila 3: Metadatos de control SIG
  ws.mergeCells('A3:C3');
  ws.getCell('A3').value = `PROCESO: ${processName.toUpperCase()}`;
  ws.getCell('A3').font = cellBoldFont;
  ws.getCell('A3').fill = lightGrayFill;

  ws.mergeCells('D3:E3');
  ws.getCell('D3').value = `CÓDIGO OFICIAL: ${code}`;
  ws.getCell('D3').font = { name: 'Courier New', size: 9, bold: true, color: { argb: 'FFB45309' } };
  ws.getCell('D3').fill = lightGrayFill;

  ws.mergeCells('F3:G3');
  ws.getCell('F3').value = 'ESTADO: VIGENTE | VERSIÓN: 01';
  ws.getCell('F3').font = cellBoldFont;
  ws.getCell('F3').fill = lightGrayFill;
  ws.getRow(3).height = 18;

  // ─── 1. FOR-COM-001: SOLICITUD DE REQUERIMIENTO DE COMPRAS ──────────────────
  if (code === 'FOR-COM-001') {
    ws.addRow([]);
    const r5 = ws.addRow(['Proyecto / Obra Destino:', '', 'Centro de Costos:', '', 'Fecha Solicitud:', 'Día: __ Mes: __ Año: 2026', '']);
    const r6 = ws.addRow(['Solicitante Responsable:', '', 'Cédula de Ciudadanía:', '', 'Prioridad:', '[  ] Baja  [  ] Media  [  ] Alta  [  ] Urgente', '']);
    const r7 = ws.addRow(['Lugar / Frente de Entrega:', '', 'Teléfono de Contacto:', '', 'Fecha Límite Requerida:', '____ / ____ / 2026', '']);
    [r5, r6, r7].forEach((r) => {
      r.height = 19;
      r.getCell(1).font = cellBoldFont;
      r.getCell(3).font = cellBoldFont;
      r.getCell(5).font = cellBoldFont;
    });

    ws.addRow([]);
    const rJustTitle = ws.addRow(['JUSTIFICACIÓN OPERATIVA DE LA NECESIDAD:']);
    rJustTitle.getCell(1).font = cellBoldFont;
    ws.mergeCells(`A${ws.lastRow!.number}:G${ws.lastRow!.number}`);

    const rJustBox = ws.addRow(['(Escriba aquí la justificación técnica, frente donde se utilizará y motivo de adquisición...)']);
    rJustBox.height = 30;
    rJustBox.getCell(1).font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF6B7280' } };
    ws.mergeCells(`A${ws.lastRow!.number}:G${ws.lastRow!.number}`);

    ws.addRow([]);
    const th = ws.addRow(['Ítem', 'Cant.', 'Unidad', 'Descripción Detallada del Producto o Servicio', 'Marca / Modelo', 'Proveedor Sugerido', 'Valor Unit. Est. ($ COP)']);
    th.height = 22;
    th.eachCell((c) => {
      c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = graphiteFill;
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    for (let i = 1; i <= 10; i++) {
      const row = ws.addRow([i, '', '', '', '', '', '']);
      row.height = 19;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
        if (col === 1 || col === 2 || col === 3) c.alignment = { vertical: 'middle', horizontal: 'center' };
        if (col === 7) c.numFmt = '$#,##0';
      });
    }

    ws.addRow([]);
    const sH = ws.addRow(['SOLICITANTE', '', 'COORDINADOR / DIRECTOR', '', 'COMPRAS', '', 'GERENCIA GENERAL']);
    sH.height = 18;
    sH.eachCell((c) => { c.font = cellBoldFont; c.fill = charcoalFill; c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { horizontal: 'center' }; });
    const sB = ws.addRow(['Firma:\nNombre:\nC.C.:', '', 'Firma:\nNombre:\nCargo:', '', 'Firma:\nNombre:\nVo.Bo.', '', 'Firma:\nAprobado:\nFecha:']);
    sB.height = 45;

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 8;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 40;
    ws.getColumn(5).width = 18;
    ws.getColumn(6).width = 22;
    ws.getColumn(7).width = 24;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 2. FOR-COM-002: ORDEN DE COMPRA Y ADJUDICACIÓN ─────────────────────────
  if (code === 'FOR-COM-002') {
    ws.addRow([]);
    const r5 = ws.addRow(['Código de Orden (OC):', 'OC-2026-_____', 'Requerimiento Asociado:', 'REQ-_____', 'Fecha de Emisión:', '____ / ____ / 2026', '']);
    const r6 = ws.addRow(['Razón Social Proveedor:', '', 'NIT / Identificación:', '', 'Condiciones de Pago:', '[  ] Contado  [  ] Crédito 15d  [  ] Crédito 30d', '']);
    const r7 = ws.addRow(['Fecha Pactada Entrega:', '____ / ____ / 2026', 'Lugar de Entrega:', 'Bodega Central PROCIMEC', 'Contacto Proveedor:', '', '']);
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
    ws.addRow([]);
    ws.addRow(['Proveedor Evaluado:', '', 'NIT / RUT:', '', 'Fecha Evaluación:', '____ / ____ / 2026', '']);
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
    ws.addRow([]);
    ws.addRow(['Proyecto Imputable:', '', 'Centro de Costos:', '', 'Dibujante / Modelador CAD:', '', '']);
    ws.addRow(['Periodo de Producción:', 'Desde: ____/____/2026', 'Hasta: ____/____/2026', '', 'Coordinador de Dibujo:', '', '']);

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
    ws.addRow([]);
    ws.addRow(['Responsable de Almacén:', '', 'Fecha de Actualización:', '____ / ____ / 2026', 'Ubicación Bodega:', 'Bodega Principal Barranquilla', '']);

    ws.addRow([]);
    const th = ws.addRow(['Código Activo', 'Categoría Instrumental', 'Nombre del Equipo', 'Marca / Modelo', 'Serial / Serie', 'Estado Operativo', 'Fecha Calibración Vence', 'Ubicación / Proyecto Asignado']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

    const sampleCats = [
      ['GPR-001', 'Georradar GPR', 'Unidad de Control GPR', 'Sensors & Software Noggin', 'AK-9842', 'Disponible / Conforme', '2027-01-15', 'Bodega Central'],
      ['ANT-001', 'Antena GPR', 'Antena Blindada 500 MHz', 'Sensors & Software', 'ANT-500-12', 'Disponible / Conforme', '2027-01-15', 'Bodega Central'],
      ['RTK-001', 'Receptor GNSS', 'Receptor Base y Rover RTK', 'Trimble R12 / R10', 'TR-7821-X', 'En Frente de Obra', '2026-11-30', 'Frente Magdalena'],
      ['RAD-001', 'Localizador EM', 'Transmisor y Receptor RD8100', 'Radiodetection RD8100', 'RD-55419', 'Disponible / Conforme', '2027-03-20', 'Bodega Central'],
      ['EST-001', 'Estación Total', 'Estación Total Óptica', 'Leica FlexLine TS07', 'TS-99412', 'Disponible / Conforme', '2026-12-10', 'Bodega Central'],
    ];

    sampleCats.forEach((item) => {
      const row = ws.addRow(item);
      row.height = 19;
      row.eachCell((c) => { c.font = cellFont; c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; });
    });

    for (let i = 1; i <= 8; i++) {
      const row = ws.addRow(['', '', '', '', '', '', '', '']);
      row.height = 19;
      row.eachCell((c) => { c.font = cellFont; c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; });
    }

    ws.addRow([]);
    ws.addRow(['FIRMA ALMACENISTA RESPONSABLE:', '_________________________', '', 'FIRMA DIRECCIÓN OPERATIVA:', '_________________________', '', '', '']);

    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 22;
    ws.getColumn(3).width = 26;
    ws.getColumn(4).width = 26;
    ws.getColumn(5).width = 18;
    ws.getColumn(6).width = 22;
    ws.getColumn(7).width = 24;
    ws.getColumn(8).width = 28;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 6. FOR-FIN-001: SOLICITUD Y AUTORIZACIÓN DE VIÁTICOS Y ANTICIPOS ───────
  if (code === 'FOR-FIN-001') {
    ws.addRow([]);
    const r5 = ws.addRow(['Consecutivo de Solicitud:', 'VIAT-2026-_____', 'Fecha Solicitud:', '____ / ____ / 2026', 'Proyecto Imputable:', '', '']);
    const r6 = ws.addRow(['Colaborador Beneficiario:', '', 'Cédula de Ciudadanía:', '', 'Municipio / Destino:', '', '']);
    const r7 = ws.addRow(['Fecha de Salida:', '____ / ____ / 2026', 'Fecha Estimada Retorno:', '____ / ____ / 2026', 'Total Días Comisión:', '', '']);
    [r5, r6, r7].forEach((r) => { r.height = 19; r.getCell(1).font = cellBoldFont; r.getCell(3).font = cellBoldFont; r.getCell(5).font = cellBoldFont; });

    ws.addRow([]);
    const th = ws.addRow(['Ítem', 'Rubro de Gasto Autorizado', 'Días / Cantidad', 'Valor Diario Estimado ($ COP)', 'Total Solicitado ($ COP)', 'Observaciones y Rutas', '']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

    const rubros = [
      '1. Transporte Terrestre / Pasajes / Peajes',
      '2. Hospedaje y Alojamiento de Cuadrilla',
      '3. Alimentación y Manutención Diaria',
      '4. Combustible y Movilidad de Vehículo',
      '5. Imprevistos Menores Operativos de Campo',
    ];

    rubros.forEach((rubro, idx) => {
      const row = ws.addRow([idx + 1, rubro, '', '', '', '', '']);
      row.height = 20;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 4 || col === 5) c.numFmt = '$#,##0';
      });
    });

    const rTot = ws.addRow(['', 'TOTAL ANTICIPO SOLICITADO (COP):', '', '', '', '', '']);
    rTot.getCell(2).font = cellBoldFont;
    rTot.getCell(5).font = cellBoldFont;
    rTot.getCell(5).numFmt = '$#,##0';

    ws.addRow([]);
    const sH = ws.addRow(['COLABORADOR BENEFICIARIO', '', 'DIRECTOR DE PROYECTO', '', 'TESORERÍA / FINANZAS', '', '']);
    sH.height = 18;
    sH.eachCell((c) => { c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = charcoalFill; });
    const sB = ws.addRow(['Firma:\nNombre:\nC.C.:', '', 'Firma:\nNombre:\nCargo:', '', 'Firma:\nNombre:\nAprobado:', '', '']);
    sB.height = 45;

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 40;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 24;
    ws.getColumn(5).width = 24;
    ws.getColumn(6).width = 30;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ─── 7. FOR-FIN-002: LEGALIZACIÓN Y RENDICIÓN DE GASTOS ─────────────────────
  if (code === 'FOR-FIN-002') {
    ws.addRow([]);
    ws.addRow(['Consecutivo Legalización:', 'LEG-2026-_____', 'Anticipo Vinculado:', 'VIAT-_____', 'Proyecto Imputable:', '', '']);
    ws.addRow(['Colaborador que Legaliza:', '', 'Cédula de Ciudadanía:', '', 'Monto Anticipo Recibido:', '$ 0', '']);
    ws.addRow(['Total Gastos con Soporte:', '$ 0', 'Saldo Resultante (COP):', '$ 0', 'Veredicto Saldo:', '[  ] Reintegro a PROCIMEC  [  ] Reembolso', '']);

    ws.addRow([]);
    const th = ws.addRow(['No.', 'Fecha Soporte', 'Tipo Comprobante', 'No. Factura / Doc', 'Razón Social / Proveedor', 'NIT', 'Concepto del Gasto', 'Valor Pagado ($ COP)']);
    th.height = 22;
    th.eachCell((c) => { c.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = graphiteFill; c.alignment = { horizontal: 'center' }; });

    for (let i = 1; i <= 15; i++) {
      const row = ws.addRow([i, '', 'Factura Electrónica / Recibo', '', '', '', '', '']);
      row.height = 19;
      row.eachCell((c, col) => {
        c.font = cellFont;
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (col === 8) c.numFmt = '$#,##0';
      });
    }

    const rTot = ws.addRow(['', '', '', '', '', '', 'TOTAL LEGALIZADO:', '']);
    rTot.getCell(7).font = cellBoldFont;
    rTot.getCell(8).font = cellBoldFont;
    rTot.getCell(8).numFmt = '$#,##0';

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
    ws.addRow([]);
    ws.addRow(['Proyecto / Frente de Obra:', '', 'Fecha de Inspección:', 'Día: __ Mes: __ Año: 2026', 'Hora de Inicio:', '__ : __']);
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

    if (code === 'FOR-HSEQ-026') {
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
  ws.addRow([]);
  ws.addRow(['Proyecto / Frente de Trabajo:', '', 'Fecha de Registro:', 'Día: __ Mes: __ Año: 2026', 'Responsable:', '']);
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
async function generateDocxTemplate(code: string, name: string, processName: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'PROCIMEC INGENIERÍA S.A.S.', bold: true, size: 28, color: '1E2229' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'SISTEMA INTEGRADO DE GESTIÓN (SIG) — PCM CLOUD', bold: true, size: 20, color: 'EAA023' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `FORMATO OFICIAL: ${name.toUpperCase()}`, bold: true, size: 22, color: '1E2229' }),
            ],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `CÓDIGO: ${code}`, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `PROCESO: ${processName}`, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'VERSIÓN: 01 | VIGENTE', bold: true })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: '1. INFORMACIÓN GENERAL DEL REGISTRO', bold: true, size: 22, color: '1E2229' }),
            ],
          }),
          new Paragraph({ text: 'Fecha de Diligenciamiento: ____________________________________' }),
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
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ─── GENERADOR DE POWERPOINT (.pptx) PARA GPR ────────────────────────────────
async function generatePptxTemplate(code: string, name: string): Promise<Buffer> {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_16x9';

  // Diapositiva 1: Portada institucional carbón técnico
  const slide1 = pptx.addSlide();
  slide1.addShape(pptx.ShapeType?.rect || 'rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: '1E2229' },
  });
  slide1.addText('PROCIMEC INGENIERÍA S.A.S.', {
    x: 0.8,
    y: 2.2,
    fontSize: 26,
    bold: true,
    color: 'FFFFFF',
  });
  slide1.addText(`PCM CLOUD — ${name.toUpperCase()} (${code})`, {
    x: 0.8,
    y: 3.0,
    fontSize: 16,
    bold: true,
    color: 'EAA023',
  });
  slide1.addText('Plantilla Oficial de Presentación de Radargramas, Frentes de Obra y Análisis Geofísico', {
    x: 0.8,
    y: 3.8,
    fontSize: 12,
    color: 'CCCCCC',
  });

  // Diapositiva 2: Lámina Técnica de Radargrama
  const slide2 = pptx.addSlide();
  slide2.addShape(pptx.ShapeType?.rect || 'rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.7,
    fill: { color: '1E2229' },
  });
  slide2.addText(`PROCIMEC  •  ${code}  •  Perfil Georadar GPR  •  Metros Lineales [0 - 100m]`, {
    x: 0.4,
    y: 0.18,
    fontSize: 13,
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
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('code') || 'FOR-SIG-001').toUpperCase().trim();
    const reqFormat = (searchParams.get('format') || 'editable').toLowerCase();

    const meta = FORMAT_FILES_REGISTRY[code] || {
      code,
      name: `Formato ${code}`,
      process: 'Operaciones',
      editableType: 'xlsx' as const,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 1: DESCARGA DE FORMATO OFICIAL PDF (.pdf)
    // ──────────────────────────────────────────────────────────────────────────
    if (reqFormat === 'pdf') {
      // 1.1 Si es FOR-SIG-001, usar el generador oficial SIG de la plataforma
      if (code === 'FOR-SIG-001') {
        const sigPdfBuf = await generateSigChangePdf({
          official_code: 'FOR-SIG-001',
          version: '1',
          identifier_name: '____________________',
          identifier_position: '____________________',
          identifier_process: 'HSEQ & SIG',
          identification_date: '____/____/2026',
          change_description: '__________________________________________________________________',
          justification: '__________________________________________________________________',
          affected_processes: 'Todos los procesos aplicables',
          origins: [],
          work_team: [{ nombre: '', cargo: '', proceso: '' }],
          risks: [],
          activities: [],
        });
        return new NextResponse(new Uint8Array(sigPdfBuf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${meta.code}_Formato_Oficial.pdf"`,
          },
        });
      }

      // 1.2 Si es FOR-COM-001, usar el generador oficial de Requerimiento de Compra
      if (code === 'FOR-COM-001') {
        const reqDoc = createPurchaseRequestPdf({
          requestCode: 'REQ-2026-_____',
          projectName: '__________________________________',
          applicantName: '__________________________________',
          approverName: '__________________________________',
          deliveryDate: '____/____/2026',
          deliverySite: '__________________________________',
          contactPhone: '__________________________________',
          items: Array.from({ length: 8 }, (_, i) => ({
            item_no: i + 1,
            quantity: '',
            unit: '',
            description: '',
            unit_price: '',
          })),
        });
        const reqPdfBuf = Buffer.from(reqDoc.output('arraybuffer'));
        return new NextResponse(new Uint8Array(reqPdfBuf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${meta.code}_Formato_Oficial.pdf"`,
          },
        });
      }

      // 1.3 Generador Oficial Estructurado de PDF con Membrete Corporativo
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Membrete Institucional
      doc.setDrawColor(21, 24, 29);
      doc.setLineWidth(0.4);
      doc.rect(14, 12, 182, 24);
      doc.line(54, 12, 54, 36);
      doc.line(148, 12, 148, 36);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 34, 41);
      doc.text('PROCIMEC', 20, 21);
      doc.setFontSize(7.5);
      doc.setTextColor(234, 160, 35);
      doc.text('PCM CLOUD • ENGINEERING', 17, 26);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 34, 41);
      const splitTitle = doc.splitTextToSize(meta.name.toUpperCase(), 88);
      doc.text(splitTitle, 101, 19, { align: 'center' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`PROCESO: ${meta.process.toUpperCase()}`, 101, 31, { align: 'center' });

      doc.line(148, 20, 196, 20);
      doc.line(148, 28, 196, 28);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 34, 41);
      doc.text('CÓDIGO:', 150, 17);
      doc.setFont('Courier', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(meta.code, 168, 17);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(30, 34, 41);
      doc.text('ESTADO:', 150, 25);
      doc.setFont('Courier', 'bold');
      doc.text('VIGENTE', 168, 25);

      doc.setFont('Helvetica', 'bold');
      doc.text('VERSIÓN:', 150, 33);
      doc.setFont('Courier', 'bold');
      doc.text('01', 168, 33);

      autoTable(doc, {
        startY: 40,
        head: [['DATOS DEL REGISTRO OPERACIONAL', '']],
        body: [
          ['Proyecto / Centro de Costos:', '___________________________________________________'],
          ['Cliente / Frente de Obra:', '___________________________________________________'],
          ['Fecha de Diligenciamiento:', 'Día: ____  Mes: ____  Año: 2026'],
          ['Responsable Operativo:', '___________________________________________________'],
        ],
        theme: 'grid',
        styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 34, 41], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 127 } },
      });

      // Tabla de ítems específicos según el tipo de formato
      let customHead = [['#', 'Parámetro Operacional', 'CUMPLE', 'NO CUMPLE', 'N/A', 'Observaciones Técnicas']];
      let customBody = [
        ['1', 'Inspección de condiciones de seguridad y EPP de frente', '[   ]', '[   ]', '[   ]', ''],
        ['2', 'Verificación física y encendido de instrumental', '[   ]', '[   ]', '[   ]', ''],
        ['3', 'Calibración y verificación de parámetros de campo', '[   ]', '[   ]', '[   ]', ''],
        ['4', 'Registro de mediciones y actividades ejecutadas', '[   ]', '[   ]', '[   ]', ''],
        ['5', 'Conformidad de entrega y firmas operativas', '[   ]', '[   ]', '[   ]', ''],
      ];

      if (code === 'FOR-CAD-001') {
        customHead = [['Fecha', 'Frente / Tramo', 'Software', 'Fase', 'Horas', 'ML Modelados', 'Reproceso (SI/NO)']];
        customBody = [
          ['', '', 'Civil 3D', 'Preliminar', '', '', 'NO'],
          ['', '', 'Revit', 'Intermedio', '', '', 'NO'],
          ['', '', 'AutoCAD', 'Final', '', '', 'NO'],
          ['', '', 'Civil 3D', 'Revisión', '', '', 'NO'],
        ];
      } else if (code.startsWith('FOR-FIN')) {
        customHead = [['Ítem', 'Rubro Presupuestal', 'Días / Cantidad', 'Valor Unitario ($ COP)', 'Total ($ COP)', 'Observaciones']];
        customBody = [
          ['1', 'Transporte y Pasajes Terrestres', '', '', '', ''],
          ['2', 'Hospedaje y Alojamiento', '', '', '', ''],
          ['3', 'Alimentación Cuadrilla', '', '', '', ''],
          ['4', 'Combustible y Peajes', '', '', '', ''],
          ['5', 'Imprevistos Menores de Campo', '', '', '', ''],
        ];
      }

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: customHead,
        body: customBody,
        theme: 'grid',
        styles: { font: 'Helvetica', fontSize: 7.5, cellPadding: 3 },
        headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['ELABORÓ (RESPONSABLE)', 'REVISÓ (HSEQ)', 'APROBÓ (DIRECCIÓN)']],
        body: [['\n\n___________________\nFirma:\nNombre:', '\n\n___________________\nFirma:\nNombre:', '\n\n___________________\nFirma:\nNombre:']],
        theme: 'grid',
        styles: { font: 'Helvetica', fontSize: 7.5, halign: 'center' },
        headStyles: { fillColor: [30, 34, 41], textColor: [255, 255, 255] },
      });

      const pdfBuf = Buffer.from(doc.output('arraybuffer'));
      return new NextResponse(new Uint8Array(pdfBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${meta.code}_Formato_Oficial.pdf"`,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 2: ARCHIVO FÍSICO PREEXISTENTE (.xlsx o .docx)
    // ──────────────────────────────────────────────────────────────────────────
    if (meta.localFilePath) {
      const fullPath = path.join(process.cwd(), meta.localFilePath);
      if (fs.existsSync(fullPath)) {
        const fileBuf = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType =
          ext === '.xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        return new NextResponse(new Uint8Array(fileBuf), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${meta.code}_${path.basename(fullPath)}"`,
          },
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 3: POWERPOINT (.pptx)
    // ──────────────────────────────────────────────────────────────────────────
    if (reqFormat === 'pptx' || meta.editableType === 'pptx') {
      const pptxBuf = await generatePptxTemplate(meta.code, meta.name);
      return new NextResponse(new Uint8Array(pptxBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${meta.code}_Plantilla_Presentacion.pptx"`,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 4: WORD (.docx)
    // ──────────────────────────────────────────────────────────────────────────
    if (reqFormat === 'docx' || (meta.editableType === 'docx' && reqFormat !== 'xlsx')) {
      const docxBuf = await generateDocxTemplate(meta.code, meta.name, meta.process);
      return new NextResponse(new Uint8Array(docxBuf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${meta.code}_Plantilla_Oficial.docx"`,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASO 5: EXCEL (.xlsx)
    // ──────────────────────────────────────────────────────────────────────────
    // Si es FOR-SIG-001, usar la plantilla viva descargada desde Google Drive / cache
    if (code === 'FOR-SIG-001') {
      try {
        const sigExcelBuf = await fetchSigTemplateBuffer();
        return new NextResponse(new Uint8Array(sigExcelBuf), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="FOR-SIG-001_Analisis_Planificacion_Cambios.xlsx"`,
          },
        });
      } catch (driveErr) {
        console.warn('Error al obtener plantilla viva de Google Drive para SIG, usando generador local:', driveErr);
      }
    }

    const xlsxBuf = await generateExcelTemplate(meta.code, meta.name, meta.process);
    return new NextResponse(new Uint8Array(xlsxBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${meta.code}_Plantilla_Oficial.xlsx"`,
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
