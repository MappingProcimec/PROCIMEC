import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from '@/lib/logo-base64';
import {
  CommercialOpportunity,
  CommercialBudget,
  CommercialProposal,
  CommercialClosing,
  Project,
} from '@/types';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateFull(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ─── Colores Oficiales PROCIMEC ──────────────────────────────────────────────
const COLOR_CHARCOAL = [30, 34, 41] as const; // #1E2229
const COLOR_AMBER = [234, 160, 35] as const; // #EAA023
const COLOR_GRAPHITE = [42, 48, 60] as const; // #2A303C
const COLOR_MUTED = [100, 116, 139] as const; // #64748B
const COLOR_BG_LIGHT = [248, 250, 252] as const; // #F8FAFC
const COLOR_BORDER = [203, 213, 225] as const; // #CBD5E1

function renderHeader(
  doc: jsPDF,
  code: string,
  version: string,
  title: string,
  formLabel: string,
  consecutiveCode: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const curY = 12;

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

  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PROCIMEC INGENIERÍA S.A.S.', marginX + 44, curY + 2.5);

  doc.setTextColor(...COLOR_AMBER);
  doc.setFontSize(8.5);
  doc.text('PCM CLOUD — GESTIÓN COMERCIAL & PROYECTOS DE INGENIERÍA', marginX + 44, curY + 7);

  doc.setTextColor(...COLOR_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(formLabel, marginX + 44, curY + 11);

  // Badge derecho
  const badgeWidth = 48;
  const badgeHeight = 16;
  const badgeX = pageWidth - marginX - badgeWidth;
  const badgeY = curY - 2;

  doc.setFillColor(...COLOR_CHARCOAL);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'F');
  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(0.6);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'D');

  doc.setTextColor(...COLOR_AMBER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(`CÓDIGO: ${code}`, badgeX + badgeWidth / 2, badgeY + 4, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`VERSIÓN: ${version}`, badgeX + badgeWidth / 2, badgeY + 9.5, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_AMBER);
  doc.text(consecutiveCode, badgeX + badgeWidth / 2, badgeY + 14, { align: 'center' });

  // Línea divisoria
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.line(marginX, curY + 18, pageWidth - marginX, curY + 18);

  return curY + 24;
}

function renderAuditBox(
  doc: jsPDF,
  startY: number,
  authorName: string,
  authorEmail: string,
  createdAt: string,
  status: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const width = pageWidth - marginX * 2;
  const height = 16;

  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.roundedRect(marginX, startY, width, height, 2, 2, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, startY, width, height, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text('CONTROL DE AUDITORÍA & TRAZABILIDAD OFICIAL:', marginX + 4, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Elaborado por: ${authorName || 'No registrado'} (${authorEmail || 'N/A'})`, marginX + 4, startY + 10);
  doc.text(`Fecha y hora de registro: ${formatDateFull(createdAt)}`, marginX + 4, startY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_AMBER);
  doc.text(`Estado: ${status.toUpperCase()}`, marginX + width - 36, startY + 9);

  return startY + height + 6;
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. PDF DE OPORTUNIDAD COMERCIAL (FOR-CMR-001)
// ──────────────────────────────────────────────────────────────────────────────
export function generateOpportunityPdf(opp: CommercialOpportunity): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const code = opp.opportunity_code || `OPP-${opp.consecutive_number || '001'}`;
  let curY = renderHeader(
    doc,
    'FOR-CMR-001',
    '1',
    'Ficha de Oportunidad Comercial y Licitación',
    'REGISTRO OFICIAL DE OPORTUNIDAD / LICITACIÓN',
    code
  );

  curY = renderAuditBox(
    doc,
    curY,
    opp.created_by_name || opp.users?.full_name || 'Área Comercial',
    opp.created_by_email || opp.users?.email || '',
    opp.created_at,
    opp.status
  );

  const marginX = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    head: [['CAMPO DE REGISTRO', 'DETALLE TÉCNICO & COMERCIAL']],
    body: [
      ['Título de la Oportunidad', opp.opportunity_title || 'N/A'],
      ['Cliente / Razón Social', opp.client_name || 'N/A'],
      ['Contacto Principal', `${opp.client_contact || 'N/A'} | ${opp.client_phone || 'N/A'}`],
      ['Correo de Contacto', opp.client_email || 'N/A'],
      ['Línea de Servicio / Proceso', opp.service_type || 'N/A'],
      ['Presupuesto Estimado Cliente', opp.estimated_value ? formatCOP(opp.estimated_value) : 'Por definir'],
      ['Fecha Límite de Propuesta', opp.deadline_date || 'N/A'],
      ['Ubicación del Proyecto', opp.location || 'N/A'],
      ['Alcance y Requerimientos', opp.notes || 'Sin observaciones registradas.'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_CHARCOAL], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [241, 245, 249] } },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'PROCIMEC INGENIERÍA S.A.S. — Documento Confidencial Interno — Sistema Integrado de Gestión ISO 9001 / ISO 45001',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  doc.save(`${code}_Ficha_Oportunidad_PROCIMEC.pdf`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. PDF DE PRESUPUESTO APU (FOR-CMR-004)
// ──────────────────────────────────────────────────────────────────────────────
export function generateBudgetPdf(budget: CommercialBudget): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const code = budget.budget_code || `PRE-${budget.consecutive_number || '001'}`;
  let curY = renderHeader(
    doc,
    'FOR-CMR-004',
    '1',
    'Presupuesto Operativo y APU de Ingeniería',
    'FORMATO OFICIAL: ESTRUCTURA DE COSTOS APU',
    code
  );

  curY = renderAuditBox(
    doc,
    curY,
    budget.created_by_name || budget.users?.full_name || 'Ingeniería de Costos',
    budget.created_by_email || budget.users?.email || '',
    budget.created_at,
    budget.status
  );

  const marginX = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Ficha general
  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    head: [['INFORMACIÓN GENERAL DEL PRESUPUESTO', 'VALOR']],
    body: [
      ['Título del Proyecto / Alcance', budget.project_title || 'N/A'],
      ['Cliente / Destinatario', budget.client_name || 'N/A'],
      ['Especialidad de Ingeniería', budget.service_category || 'N/A'],
      ['Oportunidad Vinculada', budget.commercial_opportunities?.opportunity_code || 'Independiente (Sin Oportunidad)'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_CHARCOAL], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [241, 245, 249] } },
  });

  // Resumen de Costos Directos y AIU
  const nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: nextY,
    margin: { left: marginX, right: marginX },
    head: [['RUBRO DE COSTO DIRECTO (APU)', 'VALOR (COP)', '% DEL COSTO']],
    body: [
      [
        '1. Materiales e Insumos Civiles / Industriales',
        formatCOP(budget.direct_cost_materials || 0),
        `${budget.total_direct_cost > 0 ? (((budget.direct_cost_materials || 0) / budget.total_direct_cost) * 100).toFixed(1) : 0}%`,
      ],
      [
        '2. Equipos, Maquinaria y Herramientas',
        formatCOP(budget.direct_cost_equipment || 0),
        `${budget.total_direct_cost > 0 ? (((budget.direct_cost_equipment || 0) / budget.total_direct_cost) * 100).toFixed(1) : 0}%`,
      ],
      [
        '3. Personal, Cuadrillas y Mano de Obra Técnica',
        formatCOP(budget.direct_cost_labor || 0),
        `${budget.total_direct_cost > 0 ? (((budget.direct_cost_labor || 0) / budget.total_direct_cost) * 100).toFixed(1) : 0}%`,
      ],
      [
        '4. Logística, Viáticos y Transporte de Planta',
        formatCOP(budget.direct_cost_logistics || 0),
        `${budget.total_direct_cost > 0 ? (((budget.direct_cost_logistics || 0) / budget.total_direct_cost) * 100).toFixed(1) : 0}%`,
      ],
      [
        'TOTAL COSTOS DIRECTOS (CD)',
        formatCOP(budget.total_direct_cost || 0),
        '100.0%',
      ],
      [
        `ADMINISTRACIÓN, IMPREVISTOS Y UTILIDAD (AIU ${budget.aiu_percentage || 25}%)`,
        formatCOP(Math.round((budget.total_direct_cost * (budget.aiu_percentage || 25)) / 100)),
        `${budget.aiu_percentage || 25}%`,
      ],
      [
        'PRECIO DE VENTA SUGERIDO (ANTES DE IVA)',
        formatCOP(budget.suggested_sale_price || 0),
        '—',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_GRAPHITE], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'center' },
    },
  });

  // Desglose de ítems si existen
  if (budget.items_detail && Array.isArray(budget.items_detail) && budget.items_detail.length > 0) {
    const itemsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    autoTable(doc, {
      startY: itemsY,
      margin: { left: marginX, right: marginX },
      head: [['CATEGORÍA', 'DESCRIPCIÓN DEL ÍTEM', 'UND', 'CANT', 'VR. UNITARIO', 'SUBTOTAL']],
      body: budget.items_detail.map((it) => [
        it.category,
        it.description,
        it.unit,
        String(it.quantity),
        formatCOP(it.unit_cost),
        formatCOP(it.total_cost),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [...COLOR_CHARCOAL], textColor: [255, 255, 255], fontSize: 7.5 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'PROCIMEC INGENIERÍA S.A.S. — Presupuesto Interno Confidencial — Válido para Planificación Operativa',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  doc.save(`${code}_Presupuesto_APU_PROCIMEC.pdf`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. PDF DE COTIZACIÓN COMERCIAL (FOR-CMR-002)
// ──────────────────────────────────────────────────────────────────────────────
export function generateProposalPdf(proposal: CommercialProposal): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const code = proposal.quote_code;
  let curY = renderHeader(
    doc,
    'FOR-CMR-002',
    '1',
    'Propuesta Técnico-Económica Oficial',
    'FORMATO OFICIAL: COTIZACIÓN COMERCIAL EMITIDA',
    code
  );

  curY = renderAuditBox(
    doc,
    curY,
    proposal.created_by_name || proposal.users?.full_name || 'Dirección Comercial',
    proposal.created_by_email || proposal.users?.email || '',
    proposal.created_at,
    'EMITIDA AL CLIENTE'
  );

  const marginX = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    head: [['DATOS DE LA OFERTA', 'DETALLE']],
    body: [
      ['Cliente / Razón Social', proposal.client_name || 'N/A'],
      ['Código de Oferta Comercial', proposal.quote_code],
      ['Presupuesto APU de Referencia', proposal.commercial_budgets?.budget_code || 'Directo (Sin APU Previo)'],
      ['Proyecto Oficial Vinculado', proposal.projects?.code || proposal.projects?.name || 'Por aperturar tras adjudicación'],
      ['Alcance Técnico Ofertado', proposal.scope_description || 'N/A'],
      ['Plazo Estimado de Ejecución', `${proposal.delivery_weeks || 2} Semanas`],
      ['Validez de la Oferta', `${proposal.validity_days || 30} Días Calendario`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_CHARCOAL], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [241, 245, 249] } },
  });

  const nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: nextY,
    margin: { left: marginX, right: marginX },
    head: [['CONCEPTO ECONÓMICO', 'VALOR (COP)']],
    body: [
      ['Subtotal Antes de IVA', formatCOP(proposal.subtotal || 0)],
      ['Impuesto sobre las Ventas (IVA 19%)', formatCOP(proposal.tax_amount || 0)],
      ['VALOR TOTAL PROPUESTA COMERCIAL (CON IVA)', formatCOP(proposal.total_amount || 0)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_GRAPHITE], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
    },
  });

  if (proposal.notes) {
    const notesY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFillColor(...COLOR_BG_LIGHT);
    doc.roundedRect(marginX, notesY, pageWidth - marginX * 2, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_CHARCOAL);
    doc.text('CONDICIONES COMERCIALES Y FORMA DE PAGO:', marginX + 4, notesY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    const splitNotes = doc.splitTextToSize(proposal.notes, pageWidth - marginX * 2 - 8);
    doc.text(splitNotes, marginX + 4, notesY + 10);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'PROCIMEC INGENIERÍA S.A.S. — Oferta Técnico-Económica — Sujeta a Condiciones Contractuales',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  doc.save(`${code}_Cotizacion_Comercial_PROCIMEC.pdf`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. PDF DE CIERRE Y ADJUDICACIÓN COMERCIAL (FOR-CMR-003)
// ──────────────────────────────────────────────────────────────────────────────
export function generateClosingPdf(closing: CommercialClosing): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const code = closing.closing_code || `CIE-${closing.consecutive_number || '001'}`;
  let curY = renderHeader(
    doc,
    'FOR-CMR-003',
    '1',
    'Acta de Cierre de Negociación y Adjudicación',
    'FORMATO OFICIAL: DESENLACE CONTRACTUAL',
    code
  );

  const res = closing.result || closing.closing_type || 'won';
  curY = renderAuditBox(
    doc,
    curY,
    closing.created_by_name || closing.users?.full_name || 'Gerencia / Comercial',
    closing.created_by_email || closing.users?.email || '',
    closing.created_at,
    res === 'won' ? 'ADJUDICADA / GANADA' : 'PERDIDA / CANCELADA'
  );

  const marginX = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    head: [['PARÁMETRO DE CIERRE CONTRACTUAL', 'DETALLE']],
    body: [
      ['Resultado Final', res === 'won' ? 'ADJUDICADA / GANADA' : res === 'lost' ? 'NO ADJUDICADA / PERDIDA' : 'CANCELADA / DESIERTA'],
      ['Cotización de Referencia', closing.commercial_proposals?.quote_code || 'Directa'],
      ['Cliente', closing.commercial_proposals?.client_name || 'N/A'],
      ['Número de Contrato / Orden de Servicio (OS)', closing.contract_number || 'Pendiente de radicación'],
      ['Valor Final de Adjudicación (COP)', closing.final_contract_value || closing.final_value ? formatCOP(Number(closing.final_contract_value || closing.final_value)) : 'N/A'],
      ['Motivo de Pérdida / Deserción', closing.loss_reason || closing.reason || 'N/A (Oferta Ganada)'],
      ['Conclusiones y Lecciones Aprendidas', closing.closing_notes || closing.feedback_notes || 'Sin observaciones.'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_CHARCOAL], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: [241, 245, 249] } },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'PROCIMEC INGENIERÍA S.A.S. — Acta Oficial de Cierre — Trazabilidad Comercial ISO 9001',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  doc.save(`${code}_Acta_Cierre_PROCIMEC.pdf`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. PDF DE FICHA DE PROYECTO Y DEDUCCIONES (FOR-GPR-001)
// ──────────────────────────────────────────────────────────────────────────────
export function generateProjectFinancialPdf(project: Project): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const code = project.code || project.cost_center || 'PRJ-001';
  let curY = renderHeader(
    doc,
    'FOR-GPR-001',
    '2',
    'Ficha Técnica y Gobernanza Financiera de Proyecto',
    'FICHA TÉCNICA Y PRESUPUESTO DE EJECUCIÓN',
    code
  );

  curY = renderAuditBox(
    doc,
    curY,
    project.created_by || 'Dirección de Proyectos',
    'gerencia@procimec.com',
    project.created_at,
    project.is_active ? 'ACTIVO EN EJECUCIÓN' : 'CERRADO'
  );

  const marginX = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    head: [['INFORMACIÓN DEL PROYECTO', 'DETALLE']],
    body: [
      ['Nombre del Proyecto', project.name],
      ['Centro de Costos / Código', `${project.cost_center} (${project.code || ''})`],
      ['Cliente / Razón Social', project.client],
      ['Ubicación', project.location],
      ['Número de Contrato', project.contract_number || 'N/A'],
      ['Cotización Comercial Asociada', project.commercial_proposal?.quote_code || 'Sin cotización vinculada'],
      ['Metas Operativas', `Meta ML: ${project.target_ml || 0} ml | Meta M²: ${project.target_m2 || 0} m²`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_CHARCOAL], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [241, 245, 249] } },
  });

  const nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: nextY,
    margin: { left: marginX, right: marginX },
    head: [['RUBRO FINANCIERO Y DEDUCCIONES', 'PORCENTAJE', 'VALOR EN COP']],
    body: [
      ['VALOR TOTAL DEL CONTRATO (BRUTO)', '100.0%', formatCOP(project.contract_value || 0)],
      ['Deducciones Totales Aplicadas (IVA, AI, Retenciones)', `${(project.deductions_percentage || 0).toFixed(2)}%`, `-${formatCOP(project.deductions_amount || 0)}`],
      ['PRESUPUESTO DISPONIBLE PARA EJECUTAR', '—', formatCOP(project.execution_value || 0)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...COLOR_GRAPHITE], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [...COLOR_CHARCOAL], fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'PROCIMEC INGENIERÍA S.A.S. — Ficha Financiera Oficial — Gobernanza Administrativa',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  doc.save(`${code}_Ficha_Financiera_PROCIMEC.pdf`);
}
