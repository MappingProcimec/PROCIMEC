/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const title = (payload.formatTitle || 'INSPECCIÓN PRE-OPERACIONAL').toUpperCase();
  const code = payload.formatCode || 'FOR-HSEQ';
  const version = payload.version || '01';
  const equipment = payload.equipmentBrandModel || payload.droneBrandModel || 'Equipo Oficial PROCIMEC';
  const serial = payload.equipmentSerial || payload.droneSerial || 'N/A';
  const items = payload.items && payload.items.length > 0 ? payload.items : DRONE_INSPECTION_ITEMS;

  // ── 1. Encabezado Oficial PROCIMEC (Azul Marino Corporativo #1B3A5C) ──────
  doc.setFillColor(27, 58, 92);
  doc.rect(margin, 12, pageWidth - margin * 2, 18, 'F');

  // Franja Dorada Accent
  doc.setFillColor(245, 166, 35);
  doc.rect(margin, 30, pageWidth - margin * 2, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('PROCIMEC — MAPPING INGENIERÍA S.A.S.', pageWidth / 2, 18.5, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 23.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`SISTEMA DE GESTIÓN INTEGRAL HSEQ | ${code} — VERSIÓN ${version}`, pageWidth / 2, 27.5, { align: 'center' });
  // ── 2. Cuadro de Metadatos del Proyecto y Equipo ───────────────────────────
  autoTable(doc, {
    startY: 34,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'left',
    },
    body: [
      [
        { content: 'PROYECTO:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        payload.projectName || 'N/A',
        { content: 'CENTRO DE COSTOS:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        payload.costCenter || 'N/A',
      ],
      [
        { content: 'UBICACIÓN / CIUDAD:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        payload.location || 'En campo',
        { content: 'FECHA INSPECCIÓN:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        payload.inspectionDate || 'N/A',
      ],
      [
        { content: 'EQUIPO / MODELO:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        equipment,
        { content: 'SERIAL:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        serial,
      ],
    ],
  });

  // ── 3. Tabla de Ítems de Inspección del Formato Seleccionado ──────────────
  const tableRows: any[] = [];
  let currentSection = '';

  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      tableRows.push([
        {
          content: currentSection,
          colSpan: 5,
          styles: {
            fillColor: [226, 232, 240], // Slate 200
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 7.5,
          },
        },
      ]);
    }

    const resp = payload.itemsResponses[item.code] || '';
    tableRows.push([
      item.code,
      item.description,
      resp === 'SI' ? 'X' : '',
      resp === 'NO' ? 'X' : '',
      resp === 'NA' ? 'X' : '',
    ]);
  }

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['CÓD.', 'COMPONENTE / CRITERIO DE INSPECCIÓN', 'SÍ', 'NO', 'N/A']],
    body: tableRows,
    styles: {
      fontSize: 6.8,
      cellPadding: 1.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [27, 58, 92], // Azul Marino Corporativo PROCIMEC
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] },
      3: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [239, 68, 68] },
      4: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
    },
  });

  // ── 4. Observaciones y Puntos Críticos ──────────────────────────────────────
  let finalY = (doc as any).lastAutoTable.finalY + 3;

  if (finalY > 235) {
    doc.addPage();
    finalY = 15;
  }

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    body: [
      [
        { content: 'PUNTO CRÍTICO QUE INHABILITA EL EQUIPO:', styles: { fontStyle: 'bold', cellWidth: 60, fillColor: [254, 242, 242] } },
        { content: payload.criticalPoint || 'Ninguno' },
      ],
      [
        { content: 'OBSERVACIONES GENERALES:', styles: { fontStyle: 'bold', cellWidth: 60, fillColor: [248, 250, 252] } },
        { content: payload.generalObservations || 'Sin novedades adicionales reportadas.' },
      ],
    ],
  });

  // ── 5. Recuadros de Firmas Digitales con Trazo en Pantalla ─────────────────
  let signY = (doc as any).lastAutoTable.finalY + 4;
  if (signY > 235) {
    doc.addPage();
    signY = 15;
  }

  const boxWidth = (pageWidth - margin * 2 - 8) / 2;
  const boxHeight = 32;

  // Cuadro Firma Operador
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, signY, boxWidth, boxHeight, 'FD');

  // Cuadro Firma SSTA
  doc.rect(margin + boxWidth + 8, signY, boxWidth, boxHeight, 'FD');

  // Insertar imágenes de firma si existen
  try {
    if (payload.operatorSignatureDataUrl && payload.operatorSignatureDataUrl.startsWith('data:image')) {
      doc.addImage(payload.operatorSignatureDataUrl, 'PNG', margin + 4, signY + 2, boxWidth - 8, 18);
    }
  } catch (e) {
    console.warn('No se pudo estampar firma operador en PDF:', e);
  }

  try {
    if (payload.sstaSignatureDataUrl && payload.sstaSignatureDataUrl.startsWith('data:image')) {
      doc.addImage(payload.sstaSignatureDataUrl, 'PNG', margin + boxWidth + 8 + 4, signY + 2, boxWidth - 8, 18);
    }
  } catch (e) {
    console.warn('No se pudo estampar firma SSTA en PDF:', e);
  }

  // Línea y textos de pie de firma
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 6, signY + 22, margin + boxWidth - 6, signY + 22);
  doc.line(margin + boxWidth + 8 + 6, signY + 22, margin + boxWidth * 2 + 2, signY + 22);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`RESPONSABLE / OPERADOR: ${payload.operatorName || 'Colaborador'}`, margin + boxWidth / 2, signY + 26, { align: 'center' });
  doc.text(`RESPONSABLE SSTA / SST: ${payload.sstaName || 'Inspector SSTA'}`, margin + boxWidth + 8 + boxWidth / 2, signY + 26, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Firma Digital Verificada en Dispositivo', margin + boxWidth / 2, signY + 30, { align: 'center' });
  doc.text('Firma Digital Verificada en Dispositivo', margin + boxWidth + 8 + boxWidth / 2, signY + 30, { align: 'center' });

  // ── 6. Generar Output ──────────────────────────────────────────────────────
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
