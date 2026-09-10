/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from './logo-base64';
import { getDriveClient } from './hseq-drive';

export * from './hseq-definitions';
import {
  DRONE_INSPECTION_ITEMS,
  ESTACION_TOTAL_ITEMS,
  HseqPdfGenerationPayload,
  DronePdfGenerationPayload,
  getHseqFormatConfig,
} from './hseq-definitions';

// ─── Conversión Fiel de Hoja de Cálculo Excel (.xlsx) a PDF ───────────────────
export function convertWorksheetToPdf(
  ws: ExcelJS.Worksheet,
  payload: HseqPdfGenerationPayload & { templateType?: string }
): {
  fileName: string;
  pdfBase64: string;
  pdfBuffer: Buffer;
} {
  // 1. Detectar dimensión y orientación de la hoja
  let maxCol = 5;
  for (let r = 1; r <= Math.min(ws.rowCount, 25); r++) {
    ws.getRow(r).eachCell((c, col) => {
      if (col > maxCol) maxCol = col;
    });
  }
  maxCol = Math.min(maxCol, 26);
  const isLandscape = maxCol > 10;

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

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rowCells: any[] = [];
    let rowHasVal = false;

    for (let c = 1; c <= maxCol; c++) {
      if (mergedCellsToSkip.has(`${r},${c}`)) continue;

      const cell = row.getCell(c);
      let val = cell.value;
      if (val !== null && val !== undefined && val !== '') rowHasVal = true;

      if (val && typeof val === 'object' && (val as any).richText) {
        val = (val as any).richText.map((t: any) => t.text).join('');
      } else if (val && typeof val === 'object') {
        val = (val as any).text || '';
      }

      const strVal = val === null || val === undefined ? '' : String(val);

      // Ubicación de logo (celda A2 en Drone o A1 en Estación Total)
      if (r === 2 && c === 1 && !isLandscape && !logoCellPos) {
        logoCellPos = { rowIdx: tableBody.length, colIdx: rowCells.length };
      } else if (r === 1 && c === 1 && isLandscape && !logoCellPos) {
        logoCellPos = { rowIdx: tableBody.length, colIdx: rowCells.length };
      }

      // Detectar filas de firma
      if (/FIRMA RESPONSABLE DEL EQUIPO/i.test(strVal)) {
        operatorSignRowIdx = tableBody.length;
      }
      if (/FIRMA RESPONSABLE SSTA/i.test(strVal)) {
        sstaSignRowIdx = tableBody.length;
      }

      const cellDef: any = {
        content: strVal,
        styles: {},
      };

      const mergeInfo = mergeMap.get(`${r},${c}`);
      if (mergeInfo) {
        if (mergeInfo.colSpan > 1) cellDef.colSpan = mergeInfo.colSpan;
        if (mergeInfo.rowSpan > 1) cellDef.rowSpan = mergeInfo.rowSpan;
      }

      // Tipografía y tamaños derivados del Excel
      if (isLandscape) {
        cellDef.styles.fontSize = 5.2;
      } else {
        if (r === 2 && c >= 2) {
          cellDef.styles.fontSize = 11;
          cellDef.styles.fontStyle = 'bold';
        } else if (r === 1) {
          cellDef.styles.fontSize = 7;
        } else {
          cellDef.styles.fontSize = Math.min(Math.max((cell.font?.size || 9) * 0.75, 6), 9);
        }
      }

      if (cell.font?.bold) cellDef.styles.fontStyle = 'bold';
      if (cell.font?.italic) cellDef.styles.fontStyle = (cellDef.styles.fontStyle || '') + 'italic';

      // Alineación
      if (cell.alignment?.horizontal) {
        cellDef.styles.halign = cell.alignment.horizontal;
      } else if (c >= 3 && strVal === 'X') {
        cellDef.styles.halign = 'center';
      }

      if (cell.alignment?.vertical) {
        cellDef.styles.valign = cell.alignment.vertical === 'top' || cell.alignment.vertical === 'bottom' ? cell.alignment.vertical : 'middle';
      } else {
        cellDef.styles.valign = 'middle';
      }

      // Fondos grises de la plantilla oficial
      if (cell.fill && (cell.fill as any).type === 'pattern' && (cell.fill as any).pattern === 'solid') {
        cellDef.styles.fillColor = [217, 217, 217];
      }

      // Marcas 'X' de verificación en color y negrita
      if (strVal === 'X') {
        cellDef.styles.fontStyle = 'bold';
        cellDef.styles.halign = 'center';
        cellDef.styles.textColor = [15, 23, 42];
      }

      rowCells.push(cellDef);
    }

    if (rowHasVal || rowCells.length > 0) {
      tableBody.push(rowCells);
    }
  }

  // 4. Renderizado con autoTable preservando exactamente la hoja
  autoTable(doc, {
    startY: 8,
    margin: { left: 8, right: 8 },
    theme: 'grid',
    body: tableBody,
    styles: {
      lineColor: [140, 140, 140],
      lineWidth: 0.15,
      cellPadding: isLandscape ? 0.7 : 1.1,
      textColor: [0, 0, 0],
    },
    didDrawCell: (data) => {
      // Dibujar logo de PROCIMEC en la celda oficial
      if (logoCellPos && data.row.index === logoCellPos.rowIdx && data.column.index === logoCellPos.colIdx) {
        try {
          doc.addImage(PROCIMEC_LOGO_BASE64, 'JPEG', data.cell.x + 2, data.cell.y + 1, isLandscape ? 28 : 34, isLandscape ? 9 : 11);
        } catch {}
      }
      // Estampar firma digital del Operador
      if (data.row.index === operatorSignRowIdx && data.column.index === 1) {
        if (payload.operatorSignatureDataUrl && payload.operatorSignatureDataUrl.startsWith('data:image')) {
          try {
            doc.addImage(payload.operatorSignatureDataUrl, 'PNG', data.cell.x + 3, data.cell.y + 1, 35, 10);
          } catch {}
        }
      }
      // Estampar firma digital del SSTA
      if (data.row.index === sstaSignRowIdx && data.column.index === 1) {
        if (payload.sstaSignatureDataUrl && payload.sstaSignatureDataUrl.startsWith('data:image')) {
          try {
            doc.addImage(payload.sstaSignatureDataUrl, 'PNG', data.cell.x + 3, data.cell.y + 1, 35, 10);
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

  if (!isEstacion) {
    // ── Llenado de Formato Drone o Genérico (FOR-HSEQ-024 o similares) ──────────
    const replacements: Record<string, string> = {
      '{{nombre_proyecto}}': payload.projectName || '',
      '{{proyecto}}': payload.projectName || '',
      '{{centro_costos}}': payload.costCenter || '',
      '{{centro_costo}}': payload.costCenter || '',
      '{{ciudad_ubicacion}}': payload.location || '',
      '{{ubicacion}}': payload.location || '',
      '{{ciudad}}': payload.location || '',
      '{{fecha}}': payload.inspectionDate || '',
      '{{marca_modelo}}': payload.equipmentBrandModel || payload.droneBrandModel || 'DJI Mavic 3 Enterprise',
      '{{serial_drone}}': payload.equipmentSerial || payload.droneSerial || 'PROC-DRN-001',
      '{{serial}}': payload.equipmentSerial || payload.droneSerial || 'PROC-DRN-001',
      '{{firma_op}}': `${payload.operatorName || 'Operador'} (Firma Digital Verificada)`,
      '{{firma_ss}}': `${payload.sstaName || 'Responsable SSTA'} (Firma Digital Verificada)`,
      '{{observaciones}}': payload.generalObservations || 'Sin observaciones.',
      '{{punto_critico}}': payload.criticalPoint || 'Ninguno',
    };

    const items = payload.items && payload.items.length > 0 ? payload.items : DRONE_INSPECTION_ITEMS;
    for (const item of items) {
      const resp = payload.itemsResponses[item.code] || '';
      replacements[`{{${item.code}_si}}`] = resp === 'SI' ? 'X' : '';
      replacements[`{{${item.code}_no}}`] = resp === 'NO' ? 'X' : '';
      replacements[`{{${item.code}_na}}`] = resp === 'NA' ? 'X' : '';
    }

    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') {
          let text = cell.value;
          for (const [k, v] of Object.entries(replacements)) {
            if (text.includes(k)) {
              text = text.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
            }
          }
          cell.value = text;
        }
      });
    });

    // Incrustar trazos gráficos de firma en celdas de firma
    if (payload.operatorSignatureDataUrl?.startsWith('data:image')) {
      try {
        const opBuffer = Buffer.from(payload.operatorSignatureDataUrl.split(',')[1], 'base64');
        const opImgId = wb.addImage({ buffer: opBuffer as any, extension: 'png' });
        ws.addImage(opImgId, {
          tl: { col: 1.2, row: 37.1 },
          ext: { width: 130, height: 40 },
        });
      } catch {}
    }

    if (payload.sstaSignatureDataUrl?.startsWith('data:image')) {
      try {
        const sstaBuffer = Buffer.from(payload.sstaSignatureDataUrl.split(',')[1], 'base64');
        const sstaImgId = wb.addImage({ buffer: sstaBuffer as any, extension: 'png' });
        ws.addImage(sstaImgId, {
          tl: { col: 1.2, row: 38.1 },
          ext: { width: 130, height: 40 },
        });
      } catch {}
    }
  } else {
    // ── Llenado de Formato Estación Total (FOR-HSEQ-025) ─────────────────────
    const replacements: Record<string, string> = {
      '{{proyecto}}': payload.projectName || '',
      '{{ubicacion}}': payload.location || '',
    };

    ws.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (typeof cell.value === 'string') {
          let text = cell.value;
          for (const [k, v] of Object.entries(replacements)) {
            if (text.includes(k)) {
              text = text.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
            }
          }
          cell.value = text;
        }

        // Fila 3: Centro de Costos
        if (rowNumber === 3 && colNumber === 25 && payload.costCenter) {
          cell.value = `CENTRO DE COSTO: ${payload.costCenter}`;
        }

        // Fila 6: Marca/Modelo y Serial
        if (rowNumber === 6 && colNumber === 3 && (payload.equipmentBrandModel || payload.droneBrandModel)) {
          cell.value = payload.equipmentBrandModel || payload.droneBrandModel;
        }
        if (rowNumber === 6 && colNumber === 12 && (payload.equipmentSerial || payload.droneSerial)) {
          cell.value = payload.equipmentSerial || payload.droneSerial;
        }
      });
    });

    // Identificar columna del día inspeccionado (Lunes=5, Martes=8, etc.)
    const dateObj = new Date(payload.inspectionDate + 'T12:00:00Z');
    const dayOfWeek = isNaN(dateObj.getTime()) ? 1 : dateObj.getDay();
    const dayBaseCol = dayOfWeek === 0 ? 23 : 5 + (dayOfWeek - 1) * 3;

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

    // Firmas
    ws.getRow(26).getCell(5).value = `${payload.operatorName || 'Operador'} (Firma Digital Verificada)`;
    ws.getRow(27).getCell(5).value = `${payload.sstaName || 'Responsable SSTA'} (Firma Digital Verificada)`;

    // Observaciones (fila 30 a 36 según el día)
    const dayObsRow = dayOfWeek === 0 ? 36 : 30 + (dayOfWeek - 1);
    if (dayObsRow >= 30 && dayObsRow <= 36) {
      ws.getRow(dayObsRow).getCell(4).value = payload.generalObservations || 'Conforme.';
    }

    // Punto crítico
    ws.getRow(38).getCell(4).value = payload.criticalPoint || 'Ninguno';
  }

  const excelBuffer = Buffer.from(await wb.xlsx.writeBuffer());
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
