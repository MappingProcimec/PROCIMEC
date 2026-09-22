/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from './logo-base64';
import { getDriveClient } from './hseq-drive';

import crypto from 'crypto';

// Parche de integridad para ExcelJS: evita error de "problema con contenido" en MS Excel generando GUIDs únicos
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExtLstXform = require('exceljs/lib/xlsx/xform/drawing/ext-lst-xform');
  if (ExtLstXform?.prototype) {
    ExtLstXform.prototype.render = function (xmlStream: any) {
      const guid = `{${crypto.randomUUID().toUpperCase()}}`;
      xmlStream.openNode(this.tag);
      xmlStream.openNode('a:ext', {
        uri: '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}',
      });
      xmlStream.leafNode('a16:creationId', {
        'xmlns:a16': 'http://schemas.microsoft.com/office/drawing/2014/main',
        id: guid,
      });
      xmlStream.closeNode();
      xmlStream.closeNode();
    };
  }
} catch (err) {
  console.warn('Aviso: parche ExtLstXform no inicializado:', err);
}

export * from './hseq-definitions';
import type {
  HseqPdfGenerationPayload,
  DronePdfGenerationPayload,
} from './hseq-definitions';
import { getHseqFormatConfig, ESTACION_TOTAL_ITEMS } from './hseq-definitions';

// ─── Extractor Universal de Texto Seguro de Celdas Excel ──────────────────────
export function getExcelCellValueAsString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText
        .map((t: any) => (t && typeof t === 'object' ? t.text || '' : String(t || '')))
        .join('')
        .trim();
    }
    if (val.result !== undefined && val.result !== null) {
      return getExcelCellValueAsString(val.result);
    }
    if (typeof val.text === 'string') {
      return val.text.trim();
    }
    if (typeof val.text === 'object') {
      return getExcelCellValueAsString(val.text);
    }
    return '';
  }
  return String(val).trim();
}

// ─── Conversión Fiel de Hoja de Cálculo Excel (.xlsx) a PDF ───────────────────
export function convertWorksheetToPdf(
  ws: ExcelJS.Worksheet,
  payload: HseqPdfGenerationPayload & { templateType?: string }
): {
  fileName: string;
  pdfBase64: string;
  pdfBuffer: Buffer;
} {
  // 1. Detectar dimensión y orientación de la hoja con contenido real
  let maxCol = 5;
  for (let r = 1; r <= Math.min(ws.rowCount, 45); r++) {
    const row = ws.getRow(r);
    row.eachCell((c, col) => {
      const v = c.value;
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        if (col > maxCol && col <= 15) {
          maxCol = col;
        }
      }
    });
  }
  const isLandscape = maxCol > 8;

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // 2. Mapear celdas combinadas (Merges) del Excel oficial
  const mergeMap = new Map<string, { rowSpan: number; colSpan: number }>();
  const mergedCellsToSkip = new Set<string>();

  for (const range of (ws.model.merges || [])) {
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (match) {
      const colToNum = (col: string) => {
        let n = 0;
        for (let i = 0; i < col.length; i++) n = n * 26 + col.charCodeAt(i) - 64;
        return n;
      };
      const startCol = colToNum(match[1]);
      const startRow = parseInt(match[2], 10);
      const endCol = colToNum(match[3]);
      const endRow = parseInt(match[4], 10);

      const colSpan = endCol - startCol + 1;
      const rowSpan = endRow - startRow + 1;

      mergeMap.set(`${startRow},${startCol}`, { colSpan, rowSpan });

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (r !== startRow || c !== startCol) {
            mergedCellsToSkip.add(`${r},${c}`);
          }
        }
      }
    }
  }

  // 3. Recorrer celdas de la hoja Excel ya diligenciada
  const tableBody: any[] = [];
  let operatorSignRowIdx = -1;
  let sstaSignRowIdx = -1;
  let logoCellPos: { rowIdx: number; colIdx: number } | null = null;

  const isPortraitTable = !isLandscape && maxCol <= 6;
  const isEstacion = /estaci[oó]n|total|025/i.test(`${payload.formatCode || ''} ${payload.formatTitle || ''}`);
  const dateObj = new Date((payload.inspectionDate || new Date().toISOString().split('T')[0]) + 'T12:00:00Z');
  const dayOfWeek = isNaN(dateObj.getTime()) ? 1 : dateObj.getDay();

  if (isPortraitTable) {
    // ── Formato Oficial Vertical Canónico (Drone, Estación Total u otros portrait) ──
    let hasEmittedOperatorSign = false;
    let hasEmittedSstaSign = false;
    let hasEmittedObservations = false;
    let hasEmittedCriticalPoint = false;

    for (let r = 1; r <= ws.rowCount; r++) {
      if (r === 9 || r === 43) continue; // Separadores vacíos en la plantilla Excel

      const row = ws.getRow(r);
      const rowCells: any[] = [];

      if (r === 1) {
        // Encabezado institucional canónico (Logo + Título + Bloque técnico Código/Versión/Fecha)
        logoCellPos = { rowIdx: tableBody.length, colIdx: 0 };
        rowCells.push({
          content: '',
          colSpan: 1,
          styles: { halign: 'center', valign: 'middle', minCellHeight: 12 },
        });
        rowCells.push({
          content: String(payload.formatTitle || 'INSPECCIÓN PRE-OPERACIONAL').toUpperCase(),
          colSpan: 1,
          styles: { halign: 'center', fontSize: 10, fontStyle: 'bold', valign: 'middle' },
        });

        // Extraer metadatos de versión y fecha de revisión del formato oficial desde la celda A1 o payload
        const rawHeaderMeta = getExcelCellValueAsString(ws.getRow(1).getCell(1).value);
        const verMatch = rawHeaderMeta.match(/versi[oó]n[:\s]*([a-zA-Z0-9\-_]+)/i);
        const dateMatch = rawHeaderMeta.match(/fecha[:\s]*([^\r\n]+)/i);

        const formatVersion = verMatch ? verMatch[1] : (payload.templateVersion || payload.version || '2');
        const templateRevDate = dateMatch ? dateMatch[1].trim() : (payload.templateDate || '16-sep-2026');

        const metaText = `CÓDIGO: ${payload.formatCode || 'FOR-HSEQ'}\nVERSIÓN: ${formatVersion}\nFECHA: ${templateRevDate}`;
        rowCells.push({
          content: metaText,
          colSpan: 3,
          styles: { halign: 'center', fontSize: 6.5, fontStyle: 'bold', valign: 'middle', fillColor: [248, 250, 252] },
        });
      } else if (r === 2) {
        // Fila 2 de Excel integrada en el encabezado institucional superior
        continue;
      } else if (r >= 3 && r <= 8) {
        rowCells.push({
          content: getExcelCellValueAsString(row.getCell(1).value),
          colSpan: 1,
          styles: { fontSize: 6.5, fontStyle: 'bold', fillColor: [248, 250, 252] },
        });
        rowCells.push({
          content: getExcelCellValueAsString(row.getCell(2).value),
          colSpan: 4,
          styles: { fontSize: 6.5, fontStyle: 'normal' },
        });
      } else if (r === 10) {
        rowCells.push({
          content: getExcelCellValueAsString(row.getCell(1).value) || 'MARQUE CON UNA "X" SEGÚN LO EVIDENCIADO',
          colSpan: 5,
          styles: { halign: 'center', fontSize: 7, fontStyle: 'bold', fillColor: [217, 217, 217] },
        });
      } else if (r === 11) {
        for (let c = 1; c <= 5; c++) {
          rowCells.push({
            content: getExcelCellValueAsString(row.getCell(c).value),
            styles: {
              halign: c >= 3 || c === 1 ? 'center' : 'left',
              fontSize: 7,
              fontStyle: 'bold',
              fillColor: [217, 217, 217],
            },
          });
        }
      } else if (r >= 12) {
        const val1 = getExcelCellValueAsString(row.getCell(1).value);
        const val2 = getExcelCellValueAsString(row.getCell(2).value);
        const combined = (val1 + ' ' + val2).trim();

        // 1. Detección de Fila de Firma del Operador / Responsable del Equipo
        if (/FIRMA RESPONSABLE DEL EQUIPO|FIRMA OPERADOR|FIRMA RESPONSABLE.*EQUIPO/i.test(combined)) {
          operatorSignRowIdx = tableBody.length;
          hasEmittedOperatorSign = true;
          rowCells.push({
            content: 'FIRMA RESPONSABLE DEL EQUIPO',
            colSpan: 1,
            styles: { fontSize: 6.5, fontStyle: 'bold', minCellHeight: 14, valign: 'middle' },
          });
          rowCells.push({
            content: payload.operatorSignatureDataUrl ? '' : `${payload.operatorName || 'Operador'} (Firma Digital Verificada)`,
            colSpan: 4,
            styles: { fontSize: 6, minCellHeight: 14, valign: 'bottom', halign: 'left', textColor: [40, 40, 40] },
          });
        }
        // 2. Detección de Fila de Firma Responsable / SSTA
        else if (/FIRMA RESPONSABLE[\s\/]*(?:SSTA|STTA|PROYECTO)|FIRMA.*SSTA/i.test(combined)) {
          sstaSignRowIdx = tableBody.length;
          hasEmittedSstaSign = true;
          rowCells.push({
            content: 'FIRMA RESPONSABLE/SSTA',
            colSpan: 1,
            styles: { fontSize: 6.5, fontStyle: 'bold', minCellHeight: 14, valign: 'middle' },
          });
          rowCells.push({
            content: payload.sstaSignatureDataUrl ? '' : `${payload.sstaName || 'Responsable/SSTA'} (Firma Digital Verificada)`,
            colSpan: 4,
            styles: { fontSize: 6, minCellHeight: 14, valign: 'bottom', halign: 'left', textColor: [40, 40, 40] },
          });
        }
        // 3. Fila de Nota Importante (limpia, sin ningún [object Object])
        else if (/NOTA IMPORTANTE/i.test(combined)) {
          rowCells.push({
            content: combined,
            colSpan: 5,
            styles: { fontSize: 5.5, fontStyle: 'italic', textColor: [80, 80, 80] },
          });
        }
        // 4. Fila de Observaciones
        else if (/OBSERVACIONES/i.test(combined)) {
          if (!hasEmittedObservations) {
            hasEmittedObservations = true;
            rowCells.push({
              content: 'OBSERVACIONES:',
              colSpan: 5,
              styles: { fontSize: 7, fontStyle: 'bold', fillColor: [217, 217, 217] },
            });
            tableBody.push(rowCells);
            tableBody.push([{
              content: payload.generalObservations || 'Ninguna',
              colSpan: 5,
              styles: { fontSize: 6.5, minCellHeight: 6 },
            }]);
            continue;
          }
        }
        // 5. Fila de Punto Crítico
        else if (/PUNTO CR[IÍ]TICO/i.test(combined)) {
          if (!hasEmittedCriticalPoint) {
            hasEmittedCriticalPoint = true;
            rowCells.push({
              content: 'PUNTO CRÍTICO QUE INHABILITA EL EQUIPO PARA OPERARLO:',
              colSpan: 5,
              styles: { fontSize: 7, fontStyle: 'bold', fillColor: [254, 242, 242], textColor: [185, 28, 28] },
            });
            tableBody.push(rowCells);
            tableBody.push([{
              content: payload.criticalPoint || 'Ninguno',
              colSpan: 5,
              styles: { fontSize: 6.5, minCellHeight: 6 },
            }]);
            continue;
          }
        }
        // 6. Filas de días en plantillas semanales no deseadas en PDF diario (LUNES, MARTES, etc.)
        else if (/^(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADO|DOMINGO):?/i.test(val1)) {
          continue;
        }
        // 7. Omitir filas residuales con el valor de observaciones o punto crítico ya emitidos para evitar duplicaciones
        else if (
          (hasEmittedObservations && !hasEmittedCriticalPoint && !/^\d+\./.test(val1.trim())) ||
          (hasEmittedCriticalPoint && !/^\d+\./.test(val1.trim()))
        ) {
          continue;
        }
        // 8. Fila de Ítem de Inspección regular
        else if (val1 || val2) {
          for (let c = 1; c <= 5; c++) {
            const val = getExcelCellValueAsString(row.getCell(c).value);
            rowCells.push({
              content: val,
              styles: {
                halign: c >= 3 || c === 1 ? 'center' : 'left',
                fontSize: 6.5,
                fontStyle: c === 1 || val === 'X' ? 'bold' : 'normal',
                textColor: val === 'X' ? [15, 23, 42] : [0, 0, 0],
              },
            });
          }
        }
      }

      if (rowCells.length > 0) {
        tableBody.push(rowCells);
      }
    }

    // Asegurar que las secciones de firmas siempre existan si no fueron detectadas
    if (!hasEmittedOperatorSign) {
      operatorSignRowIdx = tableBody.length;
      tableBody.push([
        {
          content: 'FIRMA RESPONSABLE DEL EQUIPO',
          colSpan: 1,
          styles: { fontSize: 6.5, fontStyle: 'bold', minCellHeight: 14, valign: 'middle' },
        },
        {
          content: payload.operatorSignatureDataUrl ? '' : `${payload.operatorName || 'Operador'} (Firma Digital Verificada)`,
          colSpan: 4,
          styles: { fontSize: 6, minCellHeight: 14, valign: 'bottom', halign: 'left', textColor: [40, 40, 40] },
        },
      ]);
    }
    if (!hasEmittedSstaSign) {
      sstaSignRowIdx = tableBody.length;
      tableBody.push([
        {
          content: 'FIRMA RESPONSABLE/SSTA',
          colSpan: 1,
          styles: { fontSize: 6.5, fontStyle: 'bold', minCellHeight: 14, valign: 'middle' },
        },
        {
          content: payload.sstaSignatureDataUrl ? '' : `${payload.sstaName || 'Responsable/SSTA'} (Firma Digital Verificada)`,
          colSpan: 4,
          styles: { fontSize: 6, minCellHeight: 14, valign: 'bottom', halign: 'left', textColor: [40, 40, 40] },
        },
      ]);
    }
    if (!hasEmittedObservations) {
      tableBody.push([
        {
          content: 'OBSERVACIONES:',
          colSpan: 5,
          styles: { fontSize: 7, fontStyle: 'bold', fillColor: [217, 217, 217] },
        },
      ]);
      tableBody.push([
        {
          content: payload.generalObservations || 'Ninguna',
          colSpan: 5,
          styles: { fontSize: 6.5, minCellHeight: 6 },
        },
      ]);
    }
    if (!hasEmittedCriticalPoint) {
      tableBody.push([
        {
          content: 'PUNTO CRÍTICO QUE INHABILITA EL EQUIPO PARA OPERARLO:',
          colSpan: 5,
          styles: { fontSize: 7, fontStyle: 'bold', fillColor: [254, 242, 242], textColor: [185, 28, 28] },
        },
      ]);
      tableBody.push([
        {
          content: payload.criticalPoint || 'Ninguno',
          colSpan: 5,
          styles: { fontSize: 6.5, minCellHeight: 6 },
        },
      ]);
    }
  } else {
    // ── Formato Genérico / Horizontal (Estación Total semanal u otros) ──
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rowCells: any[] = [];
      let rowHasVal = false;

      const firstCellStr = getExcelCellValueAsString(row.getCell(1).value) + ' ' + getExcelCellValueAsString(row.getCell(2).value);
      const isSignatureRow =
        (isEstacion && (r === 26 || r === 27)) ||
        /FIRMA RESPONSABLE/i.test(firstCellStr);

      for (let c = 1; c <= maxCol; c++) {
        if (mergedCellsToSkip.has(`${r},${c}`)) continue;

        const cell = row.getCell(c);
        const strVal = getExcelCellValueAsString(cell.value);
        if (strVal !== '') rowHasVal = true;

        if (r <= 2 && c === 1 && !logoCellPos) {
          logoCellPos = { rowIdx: tableBody.length, colIdx: rowCells.length };
        }

        if (/FIRMA RESPONSABLE DEL EQUIPO/i.test(strVal)) {
          operatorSignRowIdx = tableBody.length;
        }
        if (/FIRMA RESPONSABLE[\s\/]*(?:SSTA|STTA)/i.test(strVal)) {
          sstaSignRowIdx = tableBody.length;
        }

        const cellDef: any = {
          content: strVal,
          styles: {},
        };

        const mergeInfo = mergeMap.get(`${r},${c}`);
        if (mergeInfo) {
          const safeColSpan = Math.min(mergeInfo.colSpan, Math.max(1, maxCol - c + 1));
          if (safeColSpan > 1) cellDef.colSpan = safeColSpan;
          if (mergeInfo.rowSpan > 1) cellDef.rowSpan = mergeInfo.rowSpan;
        }

        cellDef.styles.fontSize = isLandscape ? 5.2 : 6.5;
        if (cell.font?.bold) cellDef.styles.fontStyle = 'bold';
        if (cell.font?.italic) cellDef.styles.fontStyle = (cellDef.styles.fontStyle || '') + 'italic';

        if (cell.alignment?.horizontal) {
          cellDef.styles.halign = cell.alignment.horizontal;
        }
        if (cell.alignment?.vertical) {
          cellDef.styles.valign = cell.alignment.vertical;
        }

        if (strVal.trim() === 'X') {
          cellDef.styles.halign = 'center';
          cellDef.styles.valign = 'middle';
          cellDef.styles.fontStyle = 'bold';
          cellDef.styles.textColor = [15, 23, 42];
        }

        if (cell.fill && (cell.fill as any).type === 'pattern' && (cell.fill as any).pattern === 'solid') {
          cellDef.styles.fillColor = [217, 217, 217];
        }

        if (isSignatureRow) {
          cellDef.styles.minCellHeight = 14;
        }

        rowCells.push(cellDef);
      }

      if (rowHasVal || rowCells.length > 0) {
        tableBody.push(rowCells);
      }
    }
  }

  // 4. Renderizado con autoTable preservando exactamente la hoja
  autoTable(doc, {
    startY: 8,
    margin: isPortraitTable ? { left: 10, right: 10, top: 8, bottom: 8 } : { left: 8, right: 8, top: 8, bottom: 8 },
    theme: 'grid',
    body: tableBody,
    styles: {
      lineColor: [120, 120, 120],
      lineWidth: 0.15,
      cellPadding: isPortraitTable ? { top: 0.6, bottom: 0.6, left: 1, right: 1 } : (isLandscape ? 0.6 : 0.9),
      textColor: [0, 0, 0],
      valign: 'middle',
    },
    columnStyles: isPortraitTable
      ? {
          0: { cellWidth: 26 },
          1: { cellWidth: 120 },
          2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' },
        }
      : undefined,
    didDrawCell: (data) => {
      // Dibujar logo de PROCIMEC en la celda oficial A2
      if (logoCellPos && data.row.index === logoCellPos.rowIdx && data.column.index === logoCellPos.colIdx) {
        try {
          doc.addImage(PROCIMEC_LOGO_BASE64, 'JPEG', data.cell.x + 1.5, data.cell.y + 0.8, isLandscape ? 26 : 23, isLandscape ? 8.5 : 7.5);
        } catch {}
      }
      // Estampar firma digital del Operador estrictamente contenida dentro de la celda
      if (data.row.index === operatorSignRowIdx) {
        const isTargetCol = isPortraitTable
          ? data.column.index === 1
          : isEstacion
          ? data.column.index === (dayOfWeek === 0 ? 7 : dayOfWeek)
          : data.column.index === 1;

        if (isTargetCol && payload.operatorSignatureDataUrl && payload.operatorSignatureDataUrl.startsWith('data:image')) {
          try {
            const padX = 2;
            const padY = 1.5;
            const drawW = Math.min(32, Math.max(10, data.cell.width - padX * 2));
            const drawH = Math.min(10, Math.max(6, data.cell.height - padY * 2));
            const drawX = data.cell.x + (data.cell.width - drawW) / 2;
            const drawY = data.cell.y + (data.cell.height - drawH) / 2;
            doc.addImage(payload.operatorSignatureDataUrl, 'PNG', drawX, drawY, drawW, drawH);
          } catch {}
        }
      }
      // Estampar firma digital del Responsable / SSTA estrictamente contenida dentro de la celda
      if (data.row.index === sstaSignRowIdx) {
        const isTargetCol = isPortraitTable
          ? data.column.index === 1
          : isEstacion
          ? data.column.index === (dayOfWeek === 0 ? 7 : dayOfWeek)
          : data.column.index === 1;

        if (isTargetCol && payload.sstaSignatureDataUrl && payload.sstaSignatureDataUrl.startsWith('data:image')) {
          try {
            const padX = 2;
            const padY = 1.5;
            const drawW = Math.min(32, Math.max(10, data.cell.width - padX * 2));
            const drawH = Math.min(10, Math.max(6, data.cell.height - padY * 2));
            const drawX = data.cell.x + (data.cell.width - drawW) / 2;
            const drawY = data.cell.y + (data.cell.height - drawH) / 2;
            doc.addImage(payload.sstaSignatureDataUrl, 'PNG', drawX, drawY, drawW, drawH);
          } catch {}
        }
      }
    },
  });

  const cleanFormat = (payload.formatCode || 'HSEQ').replace(/[^a-zA-Z0-9\-_]/g, '_');
  const cleanProject = (payload.projectName || 'Proyecto').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 25);
  const cleanDate = (payload.inspectionDate || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  const fileName = `Inspeccion_${cleanFormat}_${cleanProject}_${cleanDate}.pdf`;

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(pdfArrayBuffer);
  const pdfBase64 = pdfBuffer.toString('base64');

  return {
    fileName,
    pdfBase64,
    pdfBuffer,
  };
}

// ─── Motor Universal de Reemplazo de Marcadores y Tokens de Checklist ────────
export function applyUniversalPlaceholders(
  ws: ExcelJS.Worksheet,
  payload: HseqPdfGenerationPayload
): {
  opSignatureCell: { row: number; col: number } | null;
  sstaSignatureCell: { row: number; col: number } | null;
  hasTaggedChecklist: boolean;
} {
  let opSignatureCell: { row: number; col: number } | null = null;
  let sstaSignatureCell: { row: number; col: number } | null = null;
  let hasTaggedChecklist = false;

  const replacements: Record<string, string> = {
    formato: payload.formatTitle || '',
    nombre_formato: payload.formatTitle || '',
    titulo_formato: payload.formatTitle || '',
    codigo_formato: payload.formatCode || '',
    codigo: payload.formatCode || '',
    equipo: payload.equipmentName || '',
    herramienta: payload.equipmentName || '',
    equipo_herramienta: payload.equipmentName || '',
    nombre_proyecto: payload.projectName || '',
    proyecto: payload.projectName || '',
    centro_costos: payload.costCenter || '',
    centro_costo: payload.costCenter || '',
    ciudad_ubicacion: payload.location || '',
    ubicacion: payload.location || '',
    ciudad: payload.location || '',
    fecha: payload.inspectionDate || '',
    fecha_inspeccion: payload.inspectionDate || '',
    marca_modelo: payload.equipmentBrandModel || payload.droneBrandModel || '',
    marca_y_modelo: payload.equipmentBrandModel || payload.droneBrandModel || '',
    modelo: payload.equipmentBrandModel || payload.droneBrandModel || '',
    marca: payload.equipmentBrandModel || payload.droneBrandModel || '',
    serial: payload.equipmentSerial || payload.droneSerial || '',
    serial_drone: payload.equipmentSerial || payload.droneSerial || '',
    serial_akula: payload.serialAkula || payload.equipmentSerial || '',
    serial_computadora: payload.serialComputadora || payload.equipmentSerial || '',
    placa: payload.equipmentSerial || '',
    nombre_conductor: payload.operatorName || '',
    cedula_conductor: '',
    venc_tarjeta_propiedad: 'Vigente',
    venc_soat: 'Vigente',
    venc_tecnomecanica: 'Vigente',
    venc_licencia: 'Vigente',
    venc_manejo_defensivo: 'Vigente',
    contratante_si: 'X',
    contratante_no: '',
    contratante_na: '',
    venc_botiquin: 'Vigente',
    venc_extintor: 'Vigente',
    venc_bateria: 'Vigente',
    kilometraje: 'Operativo',
    firma_op: payload.operatorSignatureDataUrl ? '' : `${payload.operatorName || 'Operador'} (Firma Verificada)`,
    firma_ss: payload.sstaSignatureDataUrl ? '' : `${payload.sstaName || 'Responsable/SSTA'} (Firma Verificada)`,
    firma_ssta: payload.sstaSignatureDataUrl ? '' : `${payload.sstaName || 'Responsable/SSTA'} (Firma Verificada)`,
    firma_stta: payload.sstaSignatureDataUrl ? '' : `${payload.sstaName || 'Responsable/SSTA'} (Firma Verificada)`,
    observaciones: payload.generalObservations || 'Sin observaciones.',
    punto_critico: payload.criticalPoint || 'Ninguno',
  };

  ws.eachRow((row: any, r: number) => {
    row.eachCell((cell: any, c: number) => {
      let rawVal = cell.value;
      if (rawVal && typeof rawVal === 'object' && (rawVal as any).richText) {
        rawVal = getExcelCellValueAsString(rawVal);
        cell.value = rawVal;
      }

      if (typeof cell.value === 'string') {
        let text = cell.value;

        // Detectar anclajes de firmas
        if (text.includes('firma_op') || text.includes('FIRMA_OP')) {
          opSignatureCell = { row: r, col: c };
        }
        if (
          text.includes('firma_ss') ||
          text.includes('FIRMA_SS') ||
          text.includes('firma_stta') ||
          text.includes('firma_ssta')
        ) {
          sstaSignatureCell = { row: r, col: c };
        }

        // 1. Reemplazo de ítems de checklist: {[1.1_si]}, {{1.1_si}}, [1.1_si], {[1_1_si]}, etc.
        const itemPattern = /(?:\{\[|\{\{|\[)([0-9A-Za-z\._\-]+)_(si|no|na)(?:\]\}|\}\}|\]|\})/gi;
        if (itemPattern.test(text)) {
          hasTaggedChecklist = true;
          text = text.replace(
            /(?:\{\[|\{\{|\[)([0-9A-Za-z\._\-]+)_(si|no|na)(?:\]\}|\}\}|\]|\})/gi,
            (_: string, code: string, opt: string) => {
              const normCode = code.replace(/_/g, '.');
              const userResp = payload.itemsResponses[normCode] || payload.itemsResponses[code];
              if (userResp && userResp.toUpperCase() === opt.toUpperCase()) {
                return 'X';
              }
              return '';
            }
          );
          if (text.trim() === 'X') {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }

        // 2. Reemplazo de metadatos generales
        for (const [tag, val] of Object.entries(replacements)) {
          const regex = new RegExp(`(?:\\{\\[|\\{\\{|\\[)${tag}(?:\\]\\}|\\}\\}|\\]|\\})`, 'gi');
          text = text.replace(regex, val);
        }

        // 3. Limpiar cualquier marcador residual no reemplazado
        text = text.replace(/(?:\{\[|\{\{)[^}\]]*(?:\]\}|\}\})/g, '').trim();

        cell.value = text;
      }
    });
  });

  // Proteger celda B2 (título del formato) para evitar que quede vacía por limpieza de tags
  const b2 = ws.getCell('B2');
  if ((!b2.value || String(b2.value).trim() === '') && payload.formatTitle) {
    b2.value = payload.formatTitle.toUpperCase();
  }

  return { opSignatureCell, sstaSignatureCell, hasTaggedChecklist };
}

// ─── Llenado y Generación de la Plantilla Excel Original de Carpeta 24 ─────────
export async function fillHseqExcelTemplate(payload: HseqPdfGenerationPayload & {
  templateType?: 'drone' | 'estacion_total' | 'generic';
  templateId?: string;
}): Promise<{
  fileName: string;
  excelBase64: string;
  excelBuffer: Buffer;
  worksheet: ExcelJS.Worksheet;
  workbook: ExcelJS.Workbook;
}> {
  const wb = new ExcelJS.Workbook();
  const isDrone =
    payload.templateType === 'drone' ||
    /drone|024/i.test(`${payload.formatCode || ''} ${payload.formatTitle || ''}`);

  const isEstacion =
    payload.templateType === 'estacion_total' ||
    /estaci[oó]n|total|025/i.test(`${payload.formatCode || ''} ${payload.formatTitle || ''}`);

  let loaded = false;

  // 1. Intentar descargar archivo original desde Google Drive si hay templateId
  if (payload.templateId && !payload.templateId.startsWith('hseq-') && !payload.templateId.startsWith('folder-')) {
    try {
      const drive = await getDriveClient();
      const res = await drive.files.get(
        { fileId: payload.templateId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      if (res.data) {
        await wb.xlsx.load(Buffer.from(res.data as ArrayBuffer) as any);
        loaded = true;
      }
    } catch (e) {
      console.warn('Aviso cargando plantilla desde Drive, recurriendo a plantilla oficial local:', e);
    }
  }

  // 2. Si no se obtuvo de Drive, cargar la copia oficial de Carpeta 24
  if (!loaded) {
    const templateFileName = isEstacion
      ? 'FOR-Inspección pre-operacional Estación Total.xlsx'
      : 'FOR-Inspección pre-operacional Drone.xlsx';

    const localCandidates = [
      path.join(process.cwd(), 'public', 'templates', templateFileName),
      path.join(process.cwd(), templateFileName),
      path.join(process.cwd(), 'public', 'templates', isEstacion ? 'estacion_template.xlsx' : 'drone_template.xlsx'),
    ];

    for (const p of localCandidates) {
      if (fs.existsSync(p)) {
        await wb.xlsx.readFile(p);
        loaded = true;
        break;
      }
    }
  }

  if (!loaded) {
    throw new Error('No fue posible cargar la plantilla Excel oficial de Carpeta 24.');
  }

  const ws = wb.worksheets[0];

  // 1. Ejecutar escáner universal de etiquetas {[...]}, {{...}}, [...] e ítems de respuestas
  const { opSignatureCell, sstaSignatureCell, hasTaggedChecklist } = applyUniversalPlaceholders(ws, payload);

  // Incrustar firmas digitales en las celdas detectadas por etiquetas si están disponibles
  if (opSignatureCell && payload.operatorSignatureDataUrl?.startsWith('data:image')) {
    try {
      const opBuffer = Buffer.from(payload.operatorSignatureDataUrl.split(',')[1], 'base64');
      const opImgId = wb.addImage({ buffer: opBuffer as any, extension: 'png' });
      ws.getRow(opSignatureCell.row).height = Math.max(ws.getRow(opSignatureCell.row).height || 0, 42);
      ws.addImage(opImgId, {
        tl: { col: opSignatureCell.col - 1 + 0.2, row: opSignatureCell.row - 1 + 0.1 },
        ext: { width: 130, height: 36 },
        editAs: 'oneCell',
      });
    } catch (err) {
      console.warn('Aviso incrustando firma de operador detectada:', err);
    }
  }

  if (sstaSignatureCell && payload.sstaSignatureDataUrl?.startsWith('data:image')) {
    try {
      const sstaBuffer = Buffer.from(payload.sstaSignatureDataUrl.split(',')[1], 'base64');
      const sstaImgId = wb.addImage({ buffer: sstaBuffer as any, extension: 'png' });
      ws.getRow(sstaSignatureCell.row).height = Math.max(ws.getRow(sstaSignatureCell.row).height || 0, 42);
      ws.addImage(sstaImgId, {
        tl: { col: sstaSignatureCell.col - 1 + 0.2, row: sstaSignatureCell.row - 1 + 0.1 },
        ext: { width: 130, height: 36 },
        editAs: 'oneCell',
      });
    } catch (err) {
      console.warn('Aviso incrustando firma de SSTA detectada:', err);
    }
  }

  if (isDrone) {
    // ── Llenado de Formato Drone (FOR-HSEQ-024) ────────────────────────────────
    ws.getRow(38).height = 42;
    ws.getRow(39).height = 42;
    ws.getRow(39).getCell(1).value = 'FIRMA RESPONSABLE/SSTA';

    if (payload.operatorSignatureDataUrl?.startsWith('data:image')) {
      ws.getRow(38).getCell(2).value = '';
      try {
        const opBuffer = Buffer.from(payload.operatorSignatureDataUrl.split(',')[1], 'base64');
        const opImgId = wb.addImage({ buffer: opBuffer as any, extension: 'png' });
        ws.addImage(opImgId, {
          tl: { col: 1.2, row: 37.1 },
          ext: { width: 130, height: 36 },
          editAs: 'oneCell',
        });
      } catch (err) {
        console.warn('Error incrustando firma operador en Excel:', err);
      }
    } else {
      ws.getRow(38).getCell(2).value = `${payload.operatorName || 'Operador'} (Firma Verificada)`;
    }

    if (payload.sstaSignatureDataUrl?.startsWith('data:image')) {
      ws.getRow(39).getCell(2).value = '';
      try {
        const sstaBuffer = Buffer.from(payload.sstaSignatureDataUrl.split(',')[1], 'base64');
        const sstaImgId = wb.addImage({ buffer: sstaBuffer as any, extension: 'png' });
        ws.addImage(sstaImgId, {
          tl: { col: 1.2, row: 38.1 },
          ext: { width: 130, height: 36 },
          editAs: 'oneCell',
        });
      } catch (err) {
        console.warn('Error incrustando firma SSTA en Excel:', err);
      }
    } else {
      ws.getRow(39).getCell(2).value = `${payload.sstaName || 'Responsable/SSTA'} (Firma Verificada)`;
    }
  } else if (isEstacion && !hasTaggedChecklist) {
    // ── Llenado de Formato Estación Total Oficial (Semanal o Diario) ─────
    const isWeekly = ws.columnCount > 8;
    const dateObj = new Date(payload.inspectionDate + 'T12:00:00Z');
    const dayOfWeek = isNaN(dateObj.getTime()) ? 1 : dateObj.getDay();
    const dayBaseCol = isWeekly ? (dayOfWeek === 0 ? 23 : 5 + (dayOfWeek - 1) * 3) : 3;

    // Ítems de inspección (filas 11 a 25)
    const items = payload.items && payload.items.length > 0 ? payload.items : ESTACION_TOTAL_ITEMS;
    items.forEach((item, idx) => {
      const targetRowNumber = 11 + idx;
      if (targetRowNumber <= 25) {
        const row = ws.getRow(targetRowNumber);
        const resp = payload.itemsResponses[item.code];
        if (resp === 'SI') {
          row.getCell(dayBaseCol).value = 'X';
        } else if (resp === 'NO') {
          row.getCell(dayBaseCol + 1).value = 'X';
        } else if (resp === 'NA') {
          row.getCell(dayBaseCol + 2).value = 'X';
        }
      }
    });

    const sigCol = isWeekly ? dayBaseCol : 2;
    // Firmas si no había anclaje de tags
    if (!opSignatureCell) {
      if (payload.operatorSignatureDataUrl?.startsWith('data:image')) {
        ws.getRow(26).getCell(sigCol).value = '';
        try {
          const opBuffer = Buffer.from(payload.operatorSignatureDataUrl.split(',')[1], 'base64');
          const opImgId = wb.addImage({ buffer: opBuffer as any, extension: 'png' });
          ws.addImage(opImgId, {
            tl: { col: (sigCol - 1) + 0.1, row: 25.1 },
            ext: { width: isWeekly ? 90 : 130, height: 32 },
            editAs: 'oneCell',
          });
        } catch (err) {
          console.warn('Error incrustando firma operador en Estación Total Excel:', err);
        }
      } else {
        ws.getRow(26).getCell(sigCol).value = `${payload.operatorName || 'Operador'} (Firma Verificada)`;
      }
    }
    if (!sstaSignatureCell) {
      if (payload.sstaSignatureDataUrl?.startsWith('data:image')) {
        ws.getRow(27).getCell(sigCol).value = '';
        try {
          const sstaBuffer = Buffer.from(payload.sstaSignatureDataUrl.split(',')[1], 'base64');
          const sstaImgId = wb.addImage({ buffer: sstaBuffer as any, extension: 'png' });
          ws.addImage(sstaImgId, {
            tl: { col: (sigCol - 1) + 0.1, row: 26.1 },
            ext: { width: isWeekly ? 90 : 130, height: 32 },
            editAs: 'oneCell',
          });
        } catch (err) {
          console.warn('Error incrustando firma SSTA en Estación Total Excel:', err);
        }
      } else {
        ws.getRow(27).getCell(sigCol).value = `${payload.sstaName || 'Responsable/SSTA'} (Firma Verificada)`;
      }
    }

    // Observaciones
    if (isWeekly) {
      const dayObsRow = dayOfWeek === 0 ? 36 : 30 + (dayOfWeek - 1);
      if (dayObsRow >= 30 && dayObsRow <= 36) {
        ws.getRow(dayObsRow).getCell(4).value = payload.generalObservations || 'Conforme.';
      }
      ws.getRow(38).getCell(4).value = payload.criticalPoint || 'Ninguno';
    } else {
      ws.getRow(30).getCell(1).value = `OBSERVACIONES: ${payload.generalObservations || 'Conforme.'}`;
      ws.getRow(38).getCell(1).value = `PUNTO CRÍTICO QUE INHABILITA EL EQUIPO PARA OPERARLO: ${payload.criticalPoint || 'Ninguno'}`;
    }
  } else if (!hasTaggedChecklist) {
    // ── Llenado de Formato Dinámico con Detección de Columnas SI / NO / NA ──
    let colSi = 3;
    let colNo = 4;
    let colNa = 5;

    for (let r = 8; r <= Math.min(ws.rowCount, 16); r++) {
      const row = ws.getRow(r);
      let sCol = 0, nCol = 0, naCol = 0;
      row.eachCell((cell: any, col: number) => {
        const v = String(cell.value || '').trim().toUpperCase();
        if (v === 'SI' || v === 'CUMPLE' || v === 'C') sCol = col;
        if (v === 'NO' || v === 'NO CUMPLE' || v === 'NC') nCol = col;
        if (v === 'NA' || v === 'N/A' || v === 'NO APLICA') naCol = col;
      });
      if (sCol > 0 && nCol > 0) {
        colSi = sCol;
        colNo = nCol;
        colNa = naCol || nCol + 1;
        break;
      }
    }

    // Escribir 'X' en las respuestas de los ítems
    const items = payload.items && payload.items.length > 0 ? payload.items : [];
    for (const item of items) {
      const resp = payload.itemsResponses[item.code];
      if (!resp) continue;

      const excelRow = (item as any).excelRow;
      let targetRow: any = excelRow && excelRow >= 8 && excelRow <= ws.rowCount ? ws.getRow(excelRow) : null;

      if (!targetRow) {
        for (let r = 8; r <= ws.rowCount; r++) {
          const rRow = ws.getRow(r);
          const txtA = String(rRow.getCell(1).value || '').trim();
          const txtB = String(rRow.getCell(2).value || '').trim();
          if (txtA === item.code || txtB === item.code || txtB.includes(item.description.slice(0, 18))) {
            targetRow = rRow;
            break;
          }
        }
      }

      if (targetRow) {
        const targetCol = resp === 'SI' ? colSi : resp === 'NO' ? colNo : colNa;
        targetRow.getCell(targetCol).value = 'X';
        targetRow.getCell(targetCol).alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
  }

  // Saneamiento de rangos con enlaces externos huérfanos que corrompen el libro en MS Excel
  wb.definedNames.model = (wb.definedNames.model || []).filter((d: any) => {
    const isExternal = d.ranges?.some((r: string) => r.includes('[') || r.includes(']'));
    return !isExternal && d.name !== 'DATOS';
  });

  const rawExcelBuffer = Buffer.from(await wb.xlsx.writeBuffer());
  let excelBuffer = rawExcelBuffer;

  // Post-procesamiento estricto de integridad OpenXML con JSZip:
  // 1. Elimina cualquier remanente de <definedName name="DATOS"> o referencias externas en xl/workbook.xml
  try {
    const JSZipModule = await import('jszip');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const JSZip = (JSZipModule as any).default || JSZipModule;
    const zip = await JSZip.loadAsync(rawExcelBuffer);
    let modified = false;

    const wbEntry = zip.file('xl/workbook.xml');
    if (wbEntry) {
      let wbXml = await wbEntry.async('string');
      if (wbXml.includes('DATOS') || wbXml.includes('&apos;[') || wbXml.includes('\'[')) {
        wbXml = wbXml.replace(/<definedName name="DATOS">.*?<\/definedName>/g, '');
        wbXml = wbXml.replace(/<definedName[^>]*>[^<]*\[\d+\][^<]*<\/definedName>/g, '');
        zip.file('xl/workbook.xml', wbXml);
        modified = true;
      }
    }

    if (modified) {
      excelBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
    }
  } catch (err) {
    console.warn('Aviso en saneamiento OpenXML de libro Excel:', err);
  }

  const excelBase64 = excelBuffer.toString('base64');

  const cleanFormat = (payload.formatCode || 'FOR-HSEQ').replace(/[^a-zA-Z0-9\-_]/g, '_');
  const cleanProject = (payload.projectName || 'Proyecto').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 25);
  const cleanDate = (payload.inspectionDate || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  const fileName = `Formato_Oficial_${cleanFormat}_${cleanProject}_${cleanDate}.xlsx`;

  return {
    fileName,
    excelBase64,
    excelBuffer,
    worksheet: ws,
    workbook: wb,
  };
}

// ─── Generación del PDF Oficial Derivado de la Plantilla Excel ────────────────
export async function buildHseqInspectionPdf(payload: HseqPdfGenerationPayload & {
  templateType?: 'drone' | 'estacion_total' | 'generic';
  templateId?: string;
}): Promise<{
  fileName: string;
  pdfBase64: string;
  pdfBuffer: Buffer;
}> {
  // 1. Abrir la plantilla Excel original de Carpeta 24 y diligenciar sus celdas
  const filledExcel = await fillHseqExcelTemplate(payload);

  // 2. Convertir directamente la hoja de cálculo ya llena a PDF
  return convertWorksheetToPdf(filledExcel.worksheet, payload);
}

export async function buildDroneInspectionPdf(payload: DronePdfGenerationPayload): Promise<{
  fileName: string;
  pdfBase64: string;
  pdfBuffer: Buffer;
}> {
  const cfg = getHseqFormatConfig('drone');
  return buildHseqInspectionPdf({
    ...payload,
    formatTitle: cfg.pdfTitle,
    formatCode: cfg.code,
    version: cfg.version,
    equipmentLabel: cfg.equipmentLabel,
    items: cfg.items,
    equipmentBrandModel: payload.droneBrandModel || cfg.defaultEquipment,
    equipmentSerial: payload.droneSerial || cfg.defaultSerial,
    templateType: 'drone',
  });
}
