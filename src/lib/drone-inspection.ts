/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from './logo-base64';
import { getDriveClient } from './hseq-drive';

export interface DroneInspectionItemDef {
  code: string;
  section: string;
  description: string;
  optimal: 'SI' | 'NO' | 'NA';
}

export const DRONE_INSPECTION_SECTIONS = [
  '1. DRONE',
  '2. CONTROL REMOTO',
  '3. CABLES',
  '4. CARGADOR',
  '5. BATERÍAS',
  '6. ACCESORIOS Y HÉLICES',
] as const;

export const DRONE_INSPECTION_ITEMS: DroneInspectionItemDef[] = [
  // 1. DRONE
  {
    code: '1.1',
    section: '1. DRONE',
    description: 'Estado general del drone todos los sensores y luces funcionan',
    optimal: 'SI',
  },
  {
    code: '1.2',
    section: '1. DRONE',
    description: 'Carcasa del drone presenta golpes o grietas',
    optimal: 'NO',
  },
  {
    code: '1.3',
    section: '1. DRONE',
    description: 'Se ajustan las frecuencias y se verifica el funcionamiento de la señal del drone',
    optimal: 'SI',
  },
  {
    code: '1.4',
    section: '1. DRONE',
    description: 'Motores del drone presentan corrosión',
    optimal: 'NO',
  },
  {
    code: '1.5',
    section: '1. DRONE',
    description: 'Sistemas de conexión (puertos) del drone están en buen estado',
    optimal: 'SI',
  },
  {
    code: '1.6',
    section: '1. DRONE',
    description: 'Drone se encuentra limpio',
    optimal: 'SI',
  },
  {
    code: '1.7',
    section: '1. DRONE',
    description: 'Gimbal del drone se encuentra en buen estado y funcional',
    optimal: 'SI',
  },
  {
    code: '1.8',
    section: '1. DRONE',
    description: 'Cámara del drone se encuentra limpia, sin rayones en el lente',
    optimal: 'SI',
  },

  // 2. CONTROL REMOTO
  {
    code: '2.1',
    section: '2. CONTROL REMOTO',
    description: 'Estado general del control y todos los botones funcionan',
    optimal: 'SI',
  },
  {
    code: '2.2',
    section: '2. CONTROL REMOTO',
    description: 'Carcasa del control presenta golpes o grietas',
    optimal: 'NO',
  },
  {
    code: '2.3',
    section: '2. CONTROL REMOTO',
    description: 'Se ajustan las frecuencias y se verifica el funcionamiento de la señal del control',
    optimal: 'SI',
  },
  {
    code: '2.4',
    section: '2. CONTROL REMOTO',
    description: 'Antenas del control se encuentran en buen estado y funcionales',
    optimal: 'SI',
  },
  {
    code: '2.5',
    section: '2. CONTROL REMOTO',
    description: 'Batería del control cuenta con suficiente nivel de carga',
    optimal: 'SI',
  },
  {
    code: '2.6',
    section: '2. CONTROL REMOTO',
    description: 'Soporte de celular o tablet del control se encuentra limpio',
    optimal: 'SI',
  },

  // 3. CABLES
  {
    code: '3.1',
    section: '3. CABLES',
    description: 'Cables de datos se encuentran en buen estado sin empalmes, sin grietas',
    optimal: 'SI',
  },
  {
    code: '3.2',
    section: '3. CABLES',
    description: 'Los pines de los cables se encuentran en buen estado',
    optimal: 'SI',
  },

  // 4. CARGADOR
  {
    code: '4.1',
    section: '4. CARGADOR',
    description: 'Cargador se encuentra en buen estado',
    optimal: 'SI',
  },
  {
    code: '4.2',
    section: '4. CARGADOR',
    description: 'Cable del cargador se encuentra en buen estado sin empalmes o fisuras',
    optimal: 'SI',
  },
  {
    code: '4.3',
    section: '4. CARGADOR',
    description: 'Pines de carga del cargador están en buen estado',
    optimal: 'SI',
  },

  // 5. BATERÍAS
  {
    code: '5.1',
    section: '5. BATERÍAS',
    description: 'Batería 1 en buen estado sin grietas o fisuras',
    optimal: 'SI',
  },
  {
    code: '5.2',
    section: '5. BATERÍAS',
    description: 'Batería 2 en buen estado sin grietas o fisuras',
    optimal: 'SI',
  },
  {
    code: '5.3',
    section: '5. BATERÍAS',
    description: 'Batería 3 en buen estado sin grietas o fisuras',
    optimal: 'SI',
  },

  // 6. ACCESORIOS Y HÉLICES
  {
    code: '6.1',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Micro SD y adaptador en funcionamiento',
    optimal: 'SI',
  },
  {
    code: '6.2',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Soportes de cámara y del drone se encuentran en buen estado',
    optimal: 'SI',
  },
  {
    code: '6.3',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Cable convertidor USB a Micro USB en buen estado y funcional',
    optimal: 'SI',
  },
  {
    code: '6.4',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Hélices en buen estado y funcionales',
    optimal: 'SI',
  },
];

export const ESTACION_TOTAL_SECTIONS = [
  '1. ESTACIÓN TOTAL',
  '2. CARGADOR Y BATERÍAS',
  '3. ACCESORIOS',
] as const;

export const ESTACION_TOTAL_ITEMS: DroneInspectionItemDef[] = [
  // 1. ESTACION TOTAL
  { code: '1.1', section: '1. ESTACIÓN TOTAL', description: 'Estado general del equipo: todos los componentes funcionan', optimal: 'SI' },
  { code: '1.2', section: '1. ESTACIÓN TOTAL', description: 'La carcasa presenta golpes o grietas', optimal: 'NO' },
  { code: '1.3', section: '1. ESTACIÓN TOTAL', description: 'Los lentes se encuentran limpios y sin rayones', optimal: 'SI' },
  { code: '1.4', section: '1. ESTACIÓN TOTAL', description: 'Los tornillos de giro se encuentran suaves y funcionales', optimal: 'SI' },
  { code: '1.5', section: '1. ESTACIÓN TOTAL', description: 'Sistemas de conexión (puertos) están en buen estado', optimal: 'SI' },
  { code: '1.6', section: '1. ESTACIÓN TOTAL', description: 'El equipo se encuentra limpio', optimal: 'SI' },
  { code: '1.7', section: '1. ESTACIÓN TOTAL', description: 'El display se encuentra en buen estado', optimal: 'SI' },
  { code: '1.8', section: '1. ESTACIÓN TOTAL', description: 'La base nivelante limpia y en buen estado', optimal: 'SI' },

  // 2. CARGADOR Y BATERIAS
  { code: '2.1', section: '2. CARGADOR Y BATERÍAS', description: 'Cable se encuentra en buen estado sin empalmes o fisuras', optimal: 'SI' },
  { code: '2.2', section: '2. CARGADOR Y BATERÍAS', description: 'El enchufe del cable está en buen estado', optimal: 'SI' },
  { code: '2.3', section: '2. CARGADOR Y BATERÍAS', description: 'La batería está en buen estado', optimal: 'SI' },

  // 3. ACCESORIOS
  { code: '3.1', section: '3. ACCESORIOS', description: 'Trípode en buen estado', optimal: 'SI' },
  { code: '3.2', section: '3. ACCESORIOS', description: 'Bastón en buen estado', optimal: 'SI' },
  { code: '3.3', section: '3. ACCESORIOS', description: 'Prisma en buen estado', optimal: 'SI' },
  { code: '3.4', section: '3. ACCESORIOS', description: 'Fundas y maletas en buen estado', optimal: 'SI' },
];

export function getOptimalResponses(formatType: 'drone' | 'estacion_total' | 'generic' = 'drone'): Record<string, 'SI' | 'NO' | 'NA'> {
  const items = formatType === 'estacion_total' ? ESTACION_TOTAL_ITEMS : DRONE_INSPECTION_ITEMS;
  const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
  for (const item of items) {
    map[item.code] = item.optimal;
  }
  return map;
}

export interface HseqFormatConfig {
  id: string;
  formatType: 'drone' | 'estacion_total' | 'generic';
  code: string;
  title: string;
  pdfTitle: string;
  version: string;
  equipmentLabel: string;
  defaultEquipment: string;
  defaultSerial: string;
  sections: readonly string[];
  items: DroneInspectionItemDef[];
}

export function getHseqFormatConfig(formatIdentifier = ''): HseqFormatConfig {
  const norm = formatIdentifier.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('estacion') || norm.includes('total') || norm.includes('025') || norm.includes('ts')) {
    return {
      id: 'hseq-estacion-total',
      formatType: 'estacion_total',
      code: 'FOR-HSEQ-025',
      title: 'Inspección Pre-operacional de Estación Total',
      pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL ESTACIÓN TOTAL',
      version: '01',
      equipmentLabel: 'Estación Total',
      defaultEquipment: 'Leica FlexLine TS07',
      defaultSerial: 'PROC-ET-001',
      sections: ESTACION_TOTAL_SECTIONS,
      items: ESTACION_TOTAL_ITEMS,
    };
  }

  // Por defecto / Drone
  return {
    id: 'hseq-drone-preoperational',
    formatType: 'drone',
    code: 'FOR-HSEQ-024',
    title: 'Inspección Pre-operacional de Drone',
    pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL DRONE',
    version: '02',
    equipmentLabel: 'Drone',
    defaultEquipment: 'DJI Mavic 3 Enterprise',
    defaultSerial: 'PROC-DRN-001',
    sections: DRONE_INSPECTION_SECTIONS,
    items: DRONE_INSPECTION_ITEMS,
  };
}

export interface HseqPdfGenerationPayload {
  formatTitle?: string;
  formatCode?: string;
  version?: string;
  equipmentLabel?: string;
  projectName: string;
  costCenter: string;
  location: string;
  inspectionDate: string;
  droneBrandModel?: string;
  droneSerial?: string;
  equipmentBrandModel?: string;
  equipmentSerial?: string;
  items?: DroneInspectionItemDef[];
  itemsResponses: Record<string, 'SI' | 'NO' | 'NA'>;
  criticalPoint?: string;
  generalObservations?: string;
  operatorName: string;
  operatorSignatureDataUrl: string;
  sstaName: string;
  sstaSignatureDataUrl: string;
}

export type DronePdfGenerationPayload = HseqPdfGenerationPayload;

export async function buildHseqInspectionPdf(payload: HseqPdfGenerationPayload): Promise<{
  fileName: string;
  pdfBase64: string;
  pdfBuffer: Buffer;
}> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const margin = 10;

  const title = (payload.formatTitle || 'INSPECCIÓN PRE-OPERACIONAL DRONE').toUpperCase();
  const code = payload.formatCode || 'FOR-HSEQ-024';
  const version = payload.version || '02';
  const versionDate = payload.inspectionDate || new Date().toISOString().split('T')[0];
  const equipment = payload.equipmentBrandModel || payload.droneBrandModel || 'Equipo Oficial PROCIMEC';
  const serial = payload.equipmentSerial || payload.droneSerial || 'N/A';
  const items = payload.items && payload.items.length > 0 ? payload.items : DRONE_INSPECTION_ITEMS;

  // 1. Cabecera idéntica al Formato Excel de Carpeta 24
  const tableBody: any[] = [
    [
      {
        content: `Versión: ${version}\nFecha: ${versionDate}`,
        styles: { fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle', cellWidth: 38, fillColor: [255, 255, 255] }
      },
      {
        content: title,
        colSpan: 4,
        rowSpan: 2,
        styles: { fontStyle: 'bold', fontSize: 11, halign: 'center', valign: 'middle', textColor: [15, 23, 42] }
      }
    ],
    [
      {
        content: '',
        styles: { cellWidth: 38, minCellHeight: 12, fillColor: [255, 255, 255] }
      }
    ],
    [
      { content: 'NOMBRE PROYECTO:', styles: { fontStyle: 'bold', fontSize: 7.5, cellWidth: 36, fillColor: [248, 250, 252] } },
      { content: payload.projectName || 'N/A', colSpan: 4, styles: { fontSize: 7.5 } }
    ],
    [
      { content: 'CENTRO DE COSTO:', styles: { fontStyle: 'bold', fontSize: 7.5, cellWidth: 36, fillColor: [248, 250, 252] } },
      { content: payload.costCenter || 'N/A', colSpan: 4, styles: { fontSize: 7.5 } }
    ],
    [
      { content: 'CIUDAD / UBICACIÓN:', styles: { fontStyle: 'bold', fontSize: 7.5, cellWidth: 36, fillColor: [248, 250, 252] } },
      { content: payload.location || 'En campo', colSpan: 4, styles: { fontSize: 7.5 } }
    ],
    [
      { content: 'FECHA:', styles: { fontStyle: 'bold', fontSize: 7.5, cellWidth: 36, fillColor: [248, 250, 252] } },
      { content: payload.inspectionDate || 'N/A', colSpan: 4, styles: { fontSize: 7.5 } }
    ],
    [
      { content: 'MARCA Y MODELO:', styles: { fontStyle: 'bold', fontSize: 7.5, cellWidth: 36, fillColor: [248, 250, 252] } },
      { content: equipment, colSpan: 4, styles: { fontSize: 7.5 } }
    ],
    [
      { content: 'SERIAL:', styles: { fontStyle: 'bold', fontSize: 7.5, cellWidth: 36, fillColor: [248, 250, 252] } },
      { content: serial, colSpan: 4, styles: { fontSize: 7.5 } }
    ],
    [
      {
        content: 'MARQUE CON UNA "X" SEGÚN LO EVIDENCIADO',
        colSpan: 5,
        styles: { fontStyle: 'bold', fontSize: 8, halign: 'center', fillColor: [217, 217, 217], textColor: [15, 23, 42] }
      }
    ],
    [
      { content: 'ITEMS', styles: { fontStyle: 'bold', fontSize: 7.5, halign: 'center', fillColor: [217, 217, 217], cellWidth: 14 } },
      { content: 'REVISION', styles: { fontStyle: 'bold', fontSize: 7.5, halign: 'center', fillColor: [217, 217, 217] } },
      { content: 'SI', styles: { fontStyle: 'bold', fontSize: 7.5, halign: 'center', fillColor: [217, 217, 217], cellWidth: 12 } },
      { content: 'NO', styles: { fontStyle: 'bold', fontSize: 7.5, halign: 'center', fillColor: [217, 217, 217], cellWidth: 12 } },
      { content: 'NA', styles: { fontStyle: 'bold', fontSize: 7.5, halign: 'center', fillColor: [217, 217, 217], cellWidth: 12 } }
    ]
  ];

  // 2. Ítems del formato oficial con la 'X' en la columna correspondiente
  for (const item of items) {
    const resp = payload.itemsResponses[item.code] || '';
    tableBody.push([
      { content: item.code, styles: { fontStyle: 'bold', fontSize: 7, halign: 'center', cellWidth: 14 } },
      { content: item.description, styles: { fontSize: 6.8 } },
      { content: resp === 'SI' ? 'X' : '', styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellWidth: 12, textColor: resp === 'SI' ? [16, 185, 129] : [15, 23, 42] } },
      { content: resp === 'NO' ? 'X' : '', styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellWidth: 12, textColor: resp === 'NO' ? [239, 68, 68] : [15, 23, 42] } },
      { content: resp === 'NA' ? 'X' : '', styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellWidth: 12, textColor: [100, 116, 139] } }
    ]);
  }

  // Índices para celdas de firmas
  const operatorSignRowIndex = tableBody.length;
  tableBody.push([
    { content: 'FIRMA RESPONSABLE DEL EQUIPO', styles: { fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle', cellWidth: 36, fillColor: [248, 250, 252] } },
    { content: `Firma digital verificada: ${payload.operatorName || 'Operador'}`, colSpan: 4, styles: { fontSize: 7.5, valign: 'bottom', minCellHeight: 16 } }
  ]);

  const sstaSignRowIndex = tableBody.length;
  tableBody.push([
    { content: 'FIRMA RESPONSABLE SSTA O PROYECTO', styles: { fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle', cellWidth: 36, fillColor: [248, 250, 252] } },
    { content: `Firma digital verificada: ${payload.sstaName || 'Responsable SSTA'}`, colSpan: 4, styles: { fontSize: 7.5, valign: 'bottom', minCellHeight: 16 } }
  ]);

  // 4. Nota legal oficial idéntica a la fila 40 del Excel oficial
  tableBody.push([
    {
      content: 'NOTA IMPORTANTE: La inspección preoperacional debe realizarla ÚNICAMENTE el OPERADOR del equipo. En caso de necesitar ayuda adicional debe informarle a su SUPERVISOR quien tomará la decisión más segura.',
      colSpan: 5,
      styles: { fontSize: 6.5, fontStyle: 'italic', fillColor: [248, 250, 252], textColor: [71, 85, 105] }
    }
  ]);

  // 5. Observaciones idénticas a las filas 41 y 42 del Excel oficial
  tableBody.push([
    { content: 'OBSERVACIONES:', styles: { fontStyle: 'bold', fontSize: 7, cellWidth: 36, fillColor: [248, 250, 252] } },
    { content: payload.generalObservations || 'Sin observaciones.', colSpan: 4, styles: { fontSize: 7 } }
  ]);

  // 6. Punto crítico idéntico a las filas 44 y 45 del Excel oficial
  tableBody.push([
    { content: 'PUNTO CRÍTICO QUE INHABILITA EL EQUIPO:', styles: { fontStyle: 'bold', fontSize: 7, cellWidth: 36, fillColor: [254, 242, 242], textColor: [185, 28, 28] } },
    { content: payload.criticalPoint || 'Ninguno', colSpan: 4, styles: { fontSize: 7 } }
  ]);

  autoTable(doc, {
    startY: margin,
    margin: { left: margin, right: margin },
    theme: 'grid',
    body: tableBody,
    styles: {
      lineColor: [148, 163, 184],
      lineWidth: 0.15,
      cellPadding: 1.1,
      textColor: [15, 23, 42],
    },
    didDrawCell: (data) => {
      // Estampar Logo de PROCIMEC en celda (fila 1, col 0)
      if (data.row.index === 1 && data.column.index === 0) {
        try {
          doc.addImage(PROCIMEC_LOGO_BASE64, 'JPEG', data.cell.x + 2, data.cell.y + 1, 34, 10);
        } catch {}
      }
      // Estampar trazo de firma del operador si existe
      if (data.row.index === operatorSignRowIndex && data.column.index === 1) {
        if (payload.operatorSignatureDataUrl && payload.operatorSignatureDataUrl.startsWith('data:image')) {
          try {
            doc.addImage(payload.operatorSignatureDataUrl, 'PNG', data.cell.x + 3, data.cell.y + 1, 35, 10);
          } catch {}
        }
      }
      // Estampar trazo de firma del SSTA si existe
      if (data.row.index === sstaSignRowIndex && data.column.index === 1) {
        if (payload.sstaSignatureDataUrl && payload.sstaSignatureDataUrl.startsWith('data:image')) {
          try {
            doc.addImage(payload.sstaSignatureDataUrl, 'PNG', data.cell.x + 3, data.cell.y + 1, 35, 10);
          } catch {}
        }
      }
    }
  });

  // ── Generar Archivo PDF ──────────────────────────────────────────────────
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
  });
}

// ─── Llenado y Generación de la Plantilla Excel Original de Carpeta 24 ─────────
export async function fillHseqExcelTemplate(payload: HseqPdfGenerationPayload & {
  templateType?: 'drone' | 'estacion_total' | 'generic';
  templateId?: string;
}): Promise<{
  fileName: string;
  excelBase64: string;
  excelBuffer: Buffer;
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
    // ── Llenado de Formato Drone (FOR-HSEQ-024) ───────────────────────────────
    const replacements: Record<string, string> = {
      '{{nombre_proyecto}}': payload.projectName || '',
      '{{centro_costos}}': payload.costCenter || '',
      '{{ciudad_ubicacion}}': payload.location || '',
      '{{fecha}}': payload.inspectionDate || '',
      '{{marca_modelo}}': payload.equipmentBrandModel || payload.droneBrandModel || 'DJI Mavic 3 Enterprise',
      '{{serial_drone}}': payload.equipmentSerial || payload.droneSerial || 'PROC-DRN-001',
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
  };
}
