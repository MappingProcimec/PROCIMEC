import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from '@/lib/logo-base64';

export interface PurchaseOrderPdfItem {
  item_no?: number;
  description: string;
  quantity: number | '';
  unit?: string;
  unit_price: number | '';
  total?: number;
  notes?: string;
  delivery_date?: string;
}

export interface PurchaseOrderPdfData {
  orderCode: string;
  requestCode?: string | null;
  createdDate?: string | null;
  // Proveedor
  supplierName: string;
  supplierNit?: string | null;
  supplierContact?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddress?: string | null;
  supplierCity?: string | null;
  // Proyecto y Comprador
  projectName?: string | null;
  costCenter?: string | null;
  clientName?: string | null;
  applicantName?: string | null;
  buyerName?: string | null;
  // Condiciones
  deliveryDeadline?: string | null;
  deliverySite?: string | null;
  paymentTerms?: string | null;
  currency?: string | null;
  notes?: string | null;
  // Ítems y montos
  items: PurchaseOrderPdfItem[];
  totalAmount?: number | null;
  status?: string | null;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function createPurchaseOrderPdf(data: PurchaseOrderPdfData): jsPDF {
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

  // 1. HEADER INSTITUCIONAL CON LOGO Y MEMBRETE
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
  doc.text('PROCIMEC INGENIERÍA S.A.S.', marginX + 44, curY + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('NIT: 901.385.500-1  ·  SISTEMA INTEGRADO DE GESTIÓN HSEQ & COMPRAS', marginX + 44, curY + 7);
  doc.text('Proceso: Gestión de Compras y Cadena de Suministro', marginX + 44, curY + 11);

  // Cuadro Código Consecutivo Oficial
  const codeBoxW = 48;
  const codeBoxX = pageWidth - marginX - codeBoxW;
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(0.6);
  doc.roundedRect(codeBoxX, curY - 2, codeBoxW, 15, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_GRAPHITE);
  doc.text('ORDEN DE COMPRA OFICIAL', codeBoxX + 4, curY + 2);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.orderCode || 'OC-2026-000', codeBoxX + 4, curY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Código: FOR-COM-002  ·  Versión: 01', codeBoxX + 4, curY + 11);

  curY += 18;

  // Franja decorativa ámbar/carbón
  doc.setFillColor(...COLOR_AMBER);
  doc.rect(marginX, curY, contentWidth, 1.2, 'F');
  curY += 4;

  // 2. BLOQUE DUAL: PROVEEDOR Y CONDICIONES DE LA ORDEN
  const colW = (contentWidth - 4) / 2;

  // Columna Izquierda: Datos del Proveedor Adjudicado
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, curY, colW, 35, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLOR_GRAPHITE);
  doc.roundedRect(marginX, curY, colW, 5.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('1. INFORMACIÓN DEL PROVEEDOR ADJUDICADO', marginX + 3, curY + 4);

  let supY = curY + 9;
  doc.setFontSize(7.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Razón Social:', marginX + 3, supY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.supplierName || 'Proveedor General', marginX + 26, supY);

  supY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('NIT / Cédula:', marginX + 3, supY);
  doc.setFont('courier', 'bold');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.supplierNit || 'No registrado', marginX + 26, supY);

  supY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Contacto / Tel:', marginX + 3, supY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(`${data.supplierContact || '—'}  /  ${data.supplierPhone || '—'}`, marginX + 26, supY);

  supY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Correo Electrónico:', marginX + 3, supY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.supplierEmail || '—', marginX + 26, supY);

  supY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Ciudad / Dir:', marginX + 3, supY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(`${data.supplierCity || 'Colombia'}  ${data.supplierAddress ? `· ${data.supplierAddress}` : ''}`, marginX + 26, supY);

  // Columna Derecha: Condiciones Comerciales y Entrega
  const rightColX = marginX + colW + 4;
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(rightColX, curY, colW, 35, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLOR_GRAPHITE);
  doc.roundedRect(rightColX, curY, colW, 5.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('2. CONDICIONES COMERCIALES Y ENTREGA', rightColX + 3, curY + 4);

  let condY = curY + 9;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Proyecto / C.C.:', rightColX + 3, condY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(`${data.costCenter ? `[${data.costCenter}] ` : ''}${data.projectName || 'Operación General'}`, rightColX + 28, condY);

  condY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Solicitud Origen:', rightColX + 3, condY);
  doc.setFont('courier', 'bold');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.requestCode || 'REQ-ORIGEN', rightColX + 28, condY);

  condY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Plazo de Entrega:', rightColX + 3, condY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_AMBER);
  doc.text(data.deliveryDeadline || 'Entrega Inmediata pactada', rightColX + 28, condY);

  condY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Lugar de Entrega:', rightColX + 3, condY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.deliverySite || 'Almacén Central / Obra asignada', rightColX + 28, condY);

  condY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Forma de Pago:', rightColX + 3, condY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.paymentTerms || 'Contado', rightColX + 28, condY);

  curY += 39;

  // 3. TABLA DE ÍTEMS Y BIENES SOLICITADOS
  const tableData = (data.items || []).map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const uPrice = Number(it.unit_price) || 0;
    const tot = it.total ? Number(it.total) : qty * uPrice;
    return [
      String(it.item_no || idx + 1),
      it.description || 'Sin descripción',
      String(qty),
      it.unit || 'Und',
      formatCOP(uPrice),
      formatCOP(tot),
      it.delivery_date || data.deliveryDeadline || 'Inmediata',
    ];
  });

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    head: [['#', 'DESCRIPCIÓN DEL BIEN / SERVICIO', 'CANT.', 'UND', 'VLR. UNITARIO (COP)', 'SUBTOTAL (COP)', 'FECHA ENTREGA']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [...COLOR_CHARCOAL],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', font: 'courier' },
      1: { cellWidth: 'auto', font: 'helvetica' },
      2: { cellWidth: 14, halign: 'center', font: 'courier' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 26, halign: 'right', font: 'courier' },
      5: { cellWidth: 28, halign: 'right', font: 'courier', fontStyle: 'bold' },
      6: { cellWidth: 24, halign: 'center', font: 'courier' },
    },
    styles: {
      fontSize: 7.5,
      textColor: [...COLOR_CHARCOAL],
      cellPadding: 2,
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-expect-error autoTable plugin adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable?.finalY + 3 || curY + 40;

  // 4. TOTAL GENERAL DESTACADO
  const computedTotal = data.totalAmount || (data.items || []).reduce((acc, it) => {
    const q = Number(it.quantity) || 1;
    const u = Number(it.unit_price) || 0;
    return acc + (it.total ? Number(it.total) : q * u);
  }, 0);

  const totalBoxW = 90;
  const totalBoxX = pageWidth - marginX - totalBoxW;
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.roundedRect(totalBoxX, curY, totalBoxW, 9, 1.5, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TOTAL ORDEN DE COMPRA (COP):', totalBoxX + 4, curY + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(234, 160, 35); // Ámbar geofísico
  doc.text(formatCOP(computedTotal), totalBoxX + totalBoxW - 4, curY + 6, { align: 'right' });

  curY += 13;

  // 5. TÉRMINOS, CONDICIONES E INSTRUCCIONES DE FACTURACIÓN
  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, curY, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GRAPHITE);
  doc.text('INSTRUCCIONES DE FACTURACIÓN Y CONDICIONES OBLIGATORIAS:', marginX + 3, curY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLOR_CHARCOAL);
  const termsText = [
    '1. Facturar a nombre de PROCIMEC INGENIERÍA S.A.S. (NIT 901.385.500-1). Citar obligatoriamente este consecutivo de OC.',
    '2. Radicar la factura electrónica XML y PDF junto con la remisión de entrega firmada a satisfaccion de la obra.',
    '3. Los bienes entregados deben corresponder exactamente a las especificaciones técnicas y marcas cotizadas.',
    data.notes ? `4. Observaciones específicas: ${data.notes}` : '4. La orden de compra se formaliza con la confirmación de recibido por parte del proveedor.',
  ];
  let termY = curY + 8;
  termsText.forEach((line) => {
    doc.text(line, marginX + 3, termY);
    termY += 3.8;
  });

  curY += 28;

  // 6. CUADRO DE FIRMAS Y VALIDADORES INSTITUCIONALES
  const sigBoxW = (contentWidth - 6) / 3;
  const sigBoxH = 26;

  // Firma 1: Compras / Elaboración
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(marginX, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('EMITIDO POR (COMPRAS):', marginX + 3, curY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.buyerName || 'Departamento de Compras', marginX + 3, curY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('PROCIMEC INGENIERÍA S.A.S.', marginX + 3, curY + 18);
  doc.text('Fecha: ' + (data.createdDate || new Date().toLocaleDateString('es-CO')), marginX + 3, curY + 22);

  // Firma 2: Aprobación Gerencia
  const sig2X = marginX + sigBoxW + 3;
  doc.roundedRect(sig2X, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('APROBADO POR (GERENCIA):', sig2X + 3, curY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text('Gerencia General', sig2X + 3, curY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Aprobación Institucional Requerida', sig2X + 3, curY + 18);
  doc.text('Firma Digital Electrónica Conforme', sig2X + 3, curY + 22);

  // Firma 3: Aceptación Proveedor
  const sig3X = sig2X + sigBoxW + 3;
  doc.roundedRect(sig3X, curY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('ACEPTACIÓN PROVEEDOR:', sig3X + 3, curY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(data.supplierName || 'Firma / Sello Proveedor', sig3X + 3, curY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Firma de recibido y aceptación de OC', sig3X + 3, curY + 18);
  doc.text('Fecha: _____________________', sig3X + 3, curY + 22);

  // 7. FOOTER INSTITUCIONAL CANÓNICO (AGENTS.md Ley 7)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'PROCIMEC INGENIERÍA S.A.S.  ·  Este documento es una orden de compra oficial vinculante bajo la legislación comercial colombiana.',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
}
