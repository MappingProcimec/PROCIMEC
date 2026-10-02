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

export interface PurchaseRequestPdfSignatureItem {
  name?: string;
  cedula?: string;
  dateTime?: string;
  roleLabel?: string;
  notes?: string;
}

export interface PurchaseRequestPdfSignatures {
  applicant?: PurchaseRequestPdfSignatureItem;
  director?: PurchaseRequestPdfSignatureItem;
  purchasing?: PurchaseRequestPdfSignatureItem;
  management?: PurchaseRequestPdfSignatureItem;
}

export interface PurchaseRequestPdfData {
  requestCode: string;
  consecutive?: number;
  createdDate?: string;
  submissionDateTime?: string;
  projectName: string;
  costCenter?: string;
  clientName?: string;
  applicantName: string;
  applicantCedula?: string;
  approverName: string;
  deliveryDate: string;
  deliverySite: string;
  contactPhone: string;
  items: PurchaseRequestPdfItem[];
  totalAmount?: number;
  status?: string;
  signatures?: PurchaseRequestPdfSignatures;
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
  doc.text('4. CONTROL DE FIRMAS, VALIDACIÓN TÉCNICA Y APROBACIONES (4 INSTANCIAS)', marginX + 3, curY + 3.8);

  curY += 5.5;

  const numBoxes = 4;
  const gap = 2;
  const boxW = (contentWidth - (numBoxes - 1) * gap) / numBoxes; // 45 mm
  const boxH = 32;

  const drawSigBox = (
    bX: number,
    bY: number,
    boxTitle: string,
    sig?: { name?: string; cedula?: string; dateTime?: string; roleLabel?: string },
    fallbackName?: string,
    fallbackRole?: string
  ) => {
    // Marco exterior
    doc.setFillColor(...COLOR_BG_LIGHT);
    doc.rect(bX, bY, boxW, boxH, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(bX, bY, boxW, boxH, 'D');

    // Título de caja
    doc.setTextColor(...COLOR_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(boxTitle, bX + 2, bY + 3.5);

    const innerX = bX + 1.5;
    const innerY = bY + 4.8;
    const innerW = boxW - 3;
    const innerH = boxH - 6.2;

    if (sig && sig.name && (sig.dateTime || sig.cedula)) {
      // FIRMA REGISTRADA
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(innerX, innerY, innerW, innerH, 1, 1, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.15);
      doc.roundedRect(innerX, innerY, innerW, innerH, 1, 1, 'D');

      doc.setTextColor(16, 185, 129); // verde esmeralda
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text('✓ FIRMA REGISTRADA', bX + boxW / 2, innerY + 3.5, { align: 'center' });

      doc.setTextColor(...COLOR_CHARCOAL);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      const displayName = sig.name.length > 22 ? sig.name.substring(0, 20) + '...' : sig.name;
      doc.text(displayName, bX + boxW / 2, innerY + 7.5, { align: 'center' });

      doc.setTextColor(...COLOR_GRAPHITE);
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.2);
      doc.text(sig.cedula ? `C.C. ${sig.cedula}` : 'Cédula Registrada', bX + boxW / 2, innerY + 11.5, { align: 'center' });

      doc.setTextColor(...COLOR_MUTED);
      doc.setFont('courier', 'normal');
      doc.setFontSize(4.6);
      const dtText = sig.dateTime || displayDate;
      const cleanDt = dtText.length > 24 ? dtText.substring(0, 22) : dtText;
      doc.text(cleanDt, bX + boxW / 2, innerY + 15.5, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(4.2);
      doc.setTextColor(148, 163, 184);
      doc.text(sig.roleLabel || 'PCM CLOUD DIGITAL', bX + boxW / 2, innerY + 19.5, { align: 'center' });
    } else {
      // PENDIENTE
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(innerX, innerY, innerW, innerH, 1, 1, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.roundedRect(innerX, innerY, innerW, innerH, 1, 1, 'D');

      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text('PENDIENTE DE FIRMA', bX + boxW / 2, innerY + 4, { align: 'center' });

      doc.setTextColor(...COLOR_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      const targetName = fallbackName || 'Por asignar';
      const cleanTarget = targetName.length > 22 ? targetName.substring(0, 20) + '...' : targetName;
      doc.text(cleanTarget, bX + boxW / 2, innerY + 9, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.line(bX + 3, innerY + 14.5, bX + boxW - 3, innerY + 14.5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(4.6);
      doc.setTextColor(148, 163, 184);
      doc.text(fallbackRole || 'Aprobador', bX + boxW / 2, innerY + 18.5, { align: 'center' });
    }
  };

  // 1. Solicitante (Ingeniero de Campo)
  const applicantSig = data.signatures?.applicant || (data.applicantName ? {
    name: data.applicantName,
    cedula: data.applicantCedula,
    dateTime: data.submissionDateTime || data.createdDate || displayDate,
    roleLabel: 'Solicitante / Campo',
  } : undefined);
  drawSigBox(marginX + 0 * (boxW + gap), curY, '1. SOLICITADO POR:', applicantSig, data.applicantName, 'Ingeniero de Campo');

  // 2. Director de Proyecto (VB Técnico)
  drawSigBox(marginX + 1 * (boxW + gap), curY, '2. VB TÉCNICO PROYECTO:', data.signatures?.director, data.approverName || 'Director de Obra', 'Director de Proyecto');

  // 3. Compras (Cotización y Precios)
  drawSigBox(marginX + 2 * (boxW + gap), curY, '3. GESTIÓN COMPRAS:', data.signatures?.purchasing, 'Área de Compras', 'Cotización y Precios');

  // 4. Gerencia (Punto 4 - Aprobación Final)
  drawSigBox(marginX + 3 * (boxW + gap), curY, '4. APROBADO GERENCIA:', data.signatures?.management, 'Gerencia General', 'Aprobación Final');

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
