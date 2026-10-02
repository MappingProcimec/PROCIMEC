import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from '@/lib/logo-base64';

export interface PurchaseRequestPdfItem {
  item_no?: number;
  quantity: number | '';
  unit: string;
  description: string;
  client_quote_no?: string;
  brand?: string;
  suggested_supplier?: string;
  unit_price: number | '';
  total?: number;
}

export interface PurchaseRequestPdfData {
  requestCode: string;
  consecutive?: number;
  createdDate?: string;
  projectName: string;
  costCenter?: string;
  clientName?: string;
  applicantName: string;
  approverName: string;
  deliveryDate: string;
  deliverySite: string;
  contactPhone: string;
  items: PurchaseRequestPdfItem[];
  totalAmount?: number;
  status?: string;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function createPurchaseRequestPdf(data: PurchaseRequestPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 186 mm

  // Paleta oficial PROCIMEC (AGENTS.md)
  const COLOR_CHARCOAL = [30, 34, 41] as const; // #1E2229
  const COLOR_AMBER = [234, 160, 35] as const; // #EAA023
  const COLOR_GRAPHITE = [42, 48, 60] as const; // #2A303C
  const COLOR_MUTED = [100, 116, 139] as const; // #64748B
  const COLOR_BG_LIGHT = [248, 250, 252] as const; // #F8FAFC
  const COLOR_BORDER = [203, 213, 225] as const; // #CBD5E1

  let curY = 12;

  // 1. HEADER INSTITUCIONAL CON LOGO Y CONSECUTIVO OFICIAL
  try {
    doc.addImage(PROCIMEC_LOGO_BASE64, 'JPEG', marginX, curY - 2, 40, 14);
  } catch {
    doc.setFillColor(...COLOR_CHARCOAL);
    doc.roundedRect(marginX, curY - 2, 40, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PROCIMEC', marginX + 5, curY + 7);
  }

  // Textos Institucionales
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PROCIMEC INGENIERÍA S.A.S.', marginX + 44, curY + 2.5);

  doc.setTextColor(...COLOR_AMBER);
  doc.setFontSize(8.5);
  doc.text('PCM CLOUD — SISTEMA DE GESTIÓN OPERATIVA Y COMPRAS', marginX + 44, curY + 7);

  doc.setTextColor(...COLOR_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('FORMATO OFICIAL: SOLICITUD DE REQUERIMIENTO', marginX + 44, curY + 11);

  // Recuadro del Consecutivo Oficial a la derecha
  const badgeWidth = 48;
  const badgeHeight = 15;
  const badgeX = pageWidth - marginX - badgeWidth;
  const badgeY = curY - 2;

  doc.setFillColor(...COLOR_CHARCOAL);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'F');
  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(0.6);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'D');

  doc.setTextColor(...COLOR_AMBER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('CONSECUTIVO OFICIAL', badgeX + badgeWidth / 2, badgeY + 4, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11.5);
  doc.text(data.requestCode || 'REQ-0001', badgeX + badgeWidth / 2, badgeY + 9.5, { align: 'center' });

  const displayDate = data.createdDate || new Date().toISOString().split('T')[0];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`FECHA: ${displayDate}`, badgeX + badgeWidth / 2, badgeY + 13, { align: 'center' });

  curY += 17;

  // Franja divisoria ámbar
  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(0.8);
  doc.line(marginX, curY, pageWidth - marginX, curY);

  curY += 4;

  // 2. CUADRO DE IMPUTACIÓN Y RESPONSABLES
  // Título de Sección
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.rect(marginX, curY, contentWidth, 5.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('1. IMPUTACIÓN DE PROYECTO Y CENTRO DE COSTOS', marginX + 3, curY + 3.8);

  curY += 5.5;

  // Tabla de datos de Imputación
  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      cellPadding: 2,
      lineColor: [...COLOR_BORDER],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold', fillColor: [...COLOR_BG_LIGHT] },
      1: { cellWidth: 65 },
      2: { cellWidth: 28, fontStyle: 'bold', fillColor: [...COLOR_BG_LIGHT] },
      3: { cellWidth: 65 },
    },
    body: [
      [
        'PROYECTO DESTINO:',
        data.projectName || 'Operación General / Proyecto Asignado',
        'CENTRO DE COSTO:',
        data.costCenter || '—',
      ],
      [
        'CLIENTE PROYECTO:',
        data.clientName || 'Cliente Corporativo',
        'FECHA DE REGISTRO:',
        displayDate,
      ],
    ],
  });

  curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // Título de Sección 2
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.rect(marginX, curY, contentWidth, 5.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('2. RESPONSABLES Y DATOS DE ENTREGA EN SITIO', marginX + 3, curY + 3.8);

  curY += 5.5;

  // Tabla de datos de Entrega y Responsables
  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      cellPadding: 2,
      lineColor: [...COLOR_BORDER],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold', fillColor: [...COLOR_BG_LIGHT] },
      1: { cellWidth: 61 },
      2: { cellWidth: 32, fontStyle: 'bold', fillColor: [...COLOR_BG_LIGHT] },
      3: { cellWidth: 61 },
    },
    body: [
      [
        'SOLICITANTE:',
        data.applicantName || '—',
        'QUIEN APRUEBA:',
        data.approverName || '—',
      ],
      [
        'FECHA ENTREGA REQUERIDA:',
        data.deliveryDate || '—',
        'TELÉFONO DE CONTACTO:',
        data.contactPhone || '—',
      ],
      [
        'SITIO FÍSICO ENTREGA:',
        { content: data.deliverySite || 'Dirección de obra / campamento', colSpan: 3 },
      ],
    ],
  });

  curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // 3. TABLA DE BIENES E INSUMOS SOLICITADOS
  // Título de Sección 3
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.rect(marginX, curY, contentWidth, 5.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('3. DETALLE DE BIENES, HERRAMIENTAS O SERVICIOS REQUERIDOS', marginX + 3, curY + 3.8);

  curY += 5.5;

  // Filas de la tabla de ítems
  const items = data.items && data.items.length > 0 ? data.items : [];
  let calculatedGrandTotal = 0;

  const tableBody = items.map((it, idx) => {
    const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity) || 1;
    const unitPrice = typeof it.unit_price === 'number' ? it.unit_price : Number(it.unit_price) || 0;
    const lineTotal = it.total !== undefined ? it.total : qty * unitPrice;
    calculatedGrandTotal += lineTotal;

    return [
      String(it.item_no || idx + 1),
      String(qty),
      it.unit || 'Und',
      it.description || 'Sin descripción',
      it.client_quote_no || '—',
      it.brand || '—',
      it.suggested_supplier || '—',
      formatCOP(unitPrice),
      formatCOP(lineTotal),
    ];
  });

  const grandTotal = data.totalAmount !== undefined ? data.totalAmount : calculatedGrandTotal;

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
      lineColor: [...COLOR_BORDER],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [...COLOR_GRAPHITE],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 12, halign: 'center', font: 'courier' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 54, halign: 'left' },
      4: { cellWidth: 24, halign: 'center', font: 'courier', fontSize: 6.5 },
      5: { cellWidth: 22, halign: 'left' },
      6: { cellWidth: 24, halign: 'left' },
      7: { cellWidth: 15, halign: 'right', font: 'courier' },
      8: { cellWidth: 15, halign: 'right', font: 'courier', fontStyle: 'bold' },
    },
    head: [[
      '#',
      'CANT.',
      'UND',
      'DESCRIPCIÓN DEL BIEN O SERVICIO',
      'NO. COTIZACIÓN',
      'MARCA',
      'PROVEEDOR SUG.',
      'VR. UNIT.',
      'TOTAL (COP)',
    ]],
    body: tableBody,
  });

  curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Fila de Total General Destacada
  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      textColor: [255, 255, 255],
      cellPadding: 2.5,
      lineWidth: 0.2,
      lineColor: [...COLOR_BORDER],
    },
    columnStyles: {
      0: { cellWidth: 156, halign: 'right', fontStyle: 'bold', fillColor: [...COLOR_CHARCOAL] },
      1: { cellWidth: 30, halign: 'right', fontStyle: 'bold', fillColor: [...COLOR_AMBER], textColor: [...COLOR_CHARCOAL], font: 'courier' },
    },
    body: [[
      'TOTAL GENERAL DEL REQUERIMIENTO:',
      formatCOP(grandTotal),
    ]],
  });

  curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // 4. SECCIÓN DE FIRMAS Y APROBACIONES
  // Si no hay suficiente espacio para las firmas, crear nueva página
  if (curY + 38 > pageHeight - 15) {
    doc.addPage();
    curY = 16;
  }

  // Título de Sección 4
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.rect(marginX, curY, contentWidth, 5.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('4. CONTROL DE FIRMAS, AUTORIZACIÓN Y RECEPCIÓN', marginX + 3, curY + 3.8);

  curY += 5.5;

  const boxW = contentWidth / 3;
  const boxH = 26;

  // Caja 1: Solicitado Por
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.rect(marginX, curY, boxW, boxH, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.rect(marginX, curY, boxW, boxH, 'D');

  doc.setTextColor(...COLOR_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('SOLICITADO POR:', marginX + 3, curY + 4);

  doc.setDrawColor(...COLOR_MUTED);
  doc.setLineWidth(0.3);
  doc.line(marginX + 4, curY + 18, marginX + boxW - 4, curY + 18);

  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(data.applicantName || 'Firma Solicitante', marginX + boxW / 2, curY + 21, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Responsable de Operación / Solicitante', marginX + boxW / 2, curY + 24, { align: 'center' });

  // Caja 2: Aprobado Por
  const box2X = marginX + boxW;
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.rect(box2X, curY, boxW, boxH, 'F');
  doc.rect(box2X, curY, boxW, boxH, 'D');

  doc.setTextColor(...COLOR_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('APROBADO POR (PROYECTO):', box2X + 3, curY + 4);

  doc.line(box2X + 4, curY + 18, box2X + boxW - 4, curY + 18);

  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(data.approverName || 'Firma Aprobador', box2X + boxW / 2, curY + 21, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Residente / Director de Proyecto', box2X + boxW / 2, curY + 24, { align: 'center' });

  // Caja 3: Recepción Compras
  const box3X = marginX + boxW * 2;
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.rect(box3X, curY, boxW, boxH, 'F');
  doc.rect(box3X, curY, boxW, boxH, 'D');

  doc.setTextColor(...COLOR_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('GESTIÓN DE COMPRAS Y SUMINISTROS:', box3X + 3, curY + 4);

  doc.line(box3X + 4, curY + 18, box3X + boxW - 4, curY + 18);

  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Recepción y Radicación', box3X + boxW / 2, curY + 21, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Área de Compras | PCM CLOUD', box3X + boxW / 2, curY + 24, { align: 'center' });

  // 5. PIE DE PÁGINA EN TODAS LAS PÁGINAS
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      'Documento emitido formalmente desde PCM CLOUD — Plataforma de Gestión Empresarial | PROCIMEC Ingeniería S.A.S.',
      marginX,
      pageHeight - 6.5
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, { align: 'right' });
  }

  return doc;
}

export function downloadPurchaseRequestPdf(data: PurchaseRequestPdfData, customFileName?: string): void {
  const doc = createPurchaseRequestPdf(data);
  const code = (data.requestCode || 'REQ-0001').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = customFileName || `Solicitud_${code}_PROCIMEC.pdf`;
  doc.save(fileName);
}
