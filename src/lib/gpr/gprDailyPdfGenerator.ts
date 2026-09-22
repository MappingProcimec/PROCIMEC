/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PROCIMEC_LOGO_BASE64 } from '@/lib/logo-base64';
import { ProjectContext, GprReportContext, parseProjectDescriptionAndTargets, formatDiameter } from './geminiGprSummary';

export interface ReportPhoto {
  original_name: string;
  caption?: string | null;
  base64?: string | null;
  storage_url?: string | null;
}

export interface GeneratePdfOptions {
  project: ProjectContext;
  report: GprReportContext;
  aiSummary: string;
  photos?: ReportPhoto[];
}

export async function generateGprDailyPdf(options: GeneratePdfOptions): Promise<{
  fileName: string;
  pdfBuffer: Buffer;
  pdfBase64: string;
}> {
  const { project, report, aiSummary, photos = [] } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 186 mm

  // Paleta de colores oficial PROCIMEC (AGENTS.md)
  const COLOR_CHARCOAL = [30, 34, 41] as const; // #1E2229
  const COLOR_AMBER = [234, 160, 35] as const; // #EAA023
  const COLOR_MUTED = [100, 116, 139] as const; // #64748B
  const COLOR_LIGHT_BG = [248, 249, 250] as const;
  const COLOR_BORDER = [226, 232, 240] as const;

  let curY = 12;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. HEADER CORPORATIVO (Logo e Identidad de Marca)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    doc.addImage(PROCIMEC_LOGO_BASE64, 'PNG', marginX, curY - 2, 42, 14);
  } catch {
    doc.setFillColor(...COLOR_CHARCOAL);
    doc.rect(marginX, curY - 2, 42, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PROCIMEC', marginX + 4, curY + 6);
  }

  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PROCIMEC MAPPING E INGENIERÍA S.A.S.', marginX + 46, curY + 3);

  doc.setTextColor(...COLOR_AMBER);
  doc.setFontSize(8.5);
  doc.text('REPORTE DIARIO DE OPERACIÓN EN CAMPO — GEORADAR (GPR)', marginX + 46, curY + 7.5);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('DIVISIÓN GEOFÍSICA & MODELADO SUBTERRÁNEO CAD/BIM', marginX + 46, curY + 11.5);

  curY += 16;

  // Línea divisoria técnica
  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(0.8);
  doc.line(marginX, curY, pageWidth - marginX, curY);

  curY += 4;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CUADRO DE IDENTIFICACIÓN DEL PROYECTO (Con descripción y alcance limpio)
  // ─────────────────────────────────────────────────────────────────────────────
  const { cleanDescription, formattedTargetText, targetMl, targetM2 } = parseProjectDescriptionAndTargets(project.description);
  const hasDesc = Boolean(cleanDescription || formattedTargetText);
  const projectBoxHeight = hasDesc ? 31 : 25;

  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(marginX, curY, contentWidth, projectBoxHeight, 2, 2, 'FD');

  // Barra vertical de acento ámbar
  doc.setFillColor(...COLOR_AMBER);
  doc.rect(marginX, curY, 3, projectBoxHeight, 'F');

  doc.setTextColor(...COLOR_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PROYECTO:', marginX + 6, curY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(project.name || 'Proyecto No Asignado', marginX + 26, curY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CLIENTE:', marginX + 6, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(project.client || 'Cliente General', marginX + 26, curY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('UBICACIÓN:', marginX + 6, curY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(project.location || 'Localización técnica de obra', marginX + 26, curY + 17.5);

  if (hasDesc) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('ALCANCE / OBJETO:', marginX + 6, curY + 24.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);

    let displayScope = cleanDescription || 'Exploración y localización de servicios subterráneos';
    if (targetMl || targetM2) {
      const targetsPart = [
        targetMl ? `${targetMl.toLocaleString('es-CO')} ML` : null,
        targetM2 ? `${targetM2.toLocaleString('es-CO')} m² área exploración` : null
      ].filter(Boolean).join(' / ');
      displayScope = `${displayScope} | Meta: ${targetsPart}`;
    }

    const shortDesc = doc.splitTextToSize(displayScope, contentWidth - 45);
    doc.text(shortDesc[0] || '', marginX + 36, curY + 24.5);
  }

  // Columna derecha del cuadro de proyecto
  const colRightX = marginX + 115;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CÓDIGO / CC:', colRightX, curY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(project.code || project.cost_center || 'PRJ-GPR', colRightX + 24, curY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('FECHA OPERATIVA:', colRightX, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.report_date} ${report.report_time ? `(${report.report_time})` : ''}`, colRightX + 30, curY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.text('LOCALIZADOR:', colRightX, curY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.text(report.localizador_name || 'Personal Técnico', colRightX + 24, curY + 17.5);

  curY += projectBoxHeight + 4;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SÍNTESIS TÉCNICA OPERACIONAL (Google Gemini AI)
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setFillColor(254, 251, 243); // Tono marfil suave #FEFBF3
  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(0.4);

  const cleanSummary = (aiSummary || 'Síntesis técnica en procesamiento').trim();
  const summaryLines = doc.splitTextToSize(cleanSummary, contentWidth - 10);
  const summaryBoxHeight = Math.max(24, 11 + summaryLines.length * 4.2);

  doc.roundedRect(marginX, curY, contentWidth, summaryBoxHeight, 2, 2, 'FD');

  // Etiqueta distintiva de IA
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.roundedRect(marginX + 4, curY + 3, 76, 5.5, 1, 1, 'F');
  doc.setTextColor(...COLOR_AMBER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('SÍNTESIS TÉCNICA EJECUTIVA (GOOGLE GEMINI AI)', marginX + 6, curY + 6.8);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(summaryLines, marginX + 5, curY + 12.5);

  curY += summaryBoxHeight + 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PARÁMETROS TÉCNICOS Y CONDICIONES AMBIENTALES
  // ─────────────────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [...COLOR_CHARCOAL],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    head: [[
      'SISTEMA GPR',
      'FRECUENCIA / RDP',
      'POSICIONAMIENTO',
      'TERRENO / CLIMA',
      'PROF. MÁX (m)',
      'PRIORIDAD CAD'
    ]],
    body: [[
      report.gpr_equipment || 'Georadar GPR',
      report.antenna_frequency || 'Multi-frecuencia',
      report.positioning_equipment || 'GPS / GNSS',
      `${report.terrain_conditions || 'Normal'} / ${report.weather_conditions || 'Despejado'}`,
      `${report.global_max_depth || '1.50'} m`,
      report.cad_priority || 'Media'
    ]],
  });

  curY = (doc as any).lastAutoTable.finalY + 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. RESUMEN OPERACIONAL Y VOLUMETRÍA DE EXPLORACIÓN (Campos exactos del formulario)
  // ─────────────────────────────────────────────────────────────────────────────
  const operationalRows = report.operational_summary || [];
  const totalMl = operationalRows.reduce((sum, r) => sum + (Number(r.ml) || 0), 0);
  const totalM2 = operationalRows.reduce((sum, r) => sum + (Number(r.m2) || 0), 0);

  const operTableBody = operationalRows.map((row, idx) => {
    const sectorName = row.sector || row.axis || `Sector / Tramo ${idx + 1}`;
    const mlVal = (Number(row.ml) || 0).toFixed(2);
    const m2Val = (Number(row.m2) || 0).toFixed(2);
    const maxDepth = row.max_depth_m
      ? `${Number(row.max_depth_m).toFixed(2)} m`
      : report.global_max_depth
      ? `${Number(report.global_max_depth).toFixed(2)} m`
      : '—';
    const obs = row.observations || row.surface_type || 'Conforme';

    return [
      sectorName,
      `${mlVal} ML`,
      `${m2Val} M²`,
      maxDepth,
      obs,
    ];
  });

  // Si no hay filas, incluir fila informativa
  if (operTableBody.length === 0) {
    operTableBody.push([
      'Exploración continua de área',
      '0.00 ML',
      '0.00 M²',
      report.global_max_depth ? `${Number(report.global_max_depth).toFixed(2)} m` : '1.50 m',
      'Sin observaciones registradas'
    ]);
  }

  // Fila de totales en negrita aclarando el área de exploración
  operTableBody.push([
    'TOTAL GENERAL DE EXPLORACIÓN',
    `${totalMl.toFixed(2)} ML`,
    `${totalM2.toFixed(2)} M² (ÁREA EXPLORACIÓN)`,
    report.global_max_depth ? `${Number(report.global_max_depth).toFixed(2)} m` : '—',
    '—'
  ]);

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'striped',
    styles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [...COLOR_CHARCOAL],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 38 },
    },
    head: [[
      'SECTOR / TRAMO INSPECCIONADO',
      'LONGITUD (ML)',
      'ÁREA DE EXPLORACIÓN (M²)',
      'PROF. MÁX (m)',
      'OBSERVACIONES TÉCNICAS'
    ]],
    body: operTableBody,
    didParseCell: (data) => {
      // Estilo de la última fila (Totales)
      if (data.row.index === operTableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199]; // Amber tint #FEF3C7
        data.cell.styles.textColor = [...COLOR_CHARCOAL];
      }
    }
  });

  curY = (doc as any).lastAutoTable.finalY + 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. REDES SUBTERRÁNEAS DETECTADAS Y HALLAZGOS (Con Diámetro y Confianza)
  // ─────────────────────────────────────────────────────────────────────────────
  const utilities = report.detected_utilities || [];
  const utilBody = utilities.map((u) => {
    const serviceType = u.type || u.utility_type || 'Servicio Subterráneo';
    const diameter = formatDiameter(u.diameter) || u.material || '—';
    const estimatedDepth = u.estimated_depth_m
      ? `${Number(u.estimated_depth_m).toFixed(2)} m`
      : '—';
    const confidence = u.confidence || report.cad_priority || 'Media';
    const details = u.description || u.notes || 'Identificado en perfilograma';

    return [
      serviceType,
      diameter,
      estimatedDepth,
      confidence,
      details,
    ];
  });

  if (utilBody.length === 0) {
    utilBody.push(['No se identificaron interferencias directas en la traza', '—', '—', 'Alta', 'Sin anomalías registradas']);
  }

  // Verificar si cabe en la página actual o requerir salto
  if (curY > pageHeight - 65) {
    doc.addPage();
    curY = 16;
  }

  autoTable(doc, {
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [...COLOR_CHARCOAL],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
    },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 62 },
    },
    head: [[
      'TIPO DE SERVICIO / ANOMALÍA',
      'DIÁMETRO / DIMENSIÓN',
      'PROF. ESTIMADA',
      'NIVEL CONFIANZA',
      'DESCRIPCIÓN Y UBICACIÓN'
    ]],
    body: utilBody,
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // Observaciones adicionales y recomendaciones
  if (report.anomalies_notes || report.processing_recommendations || report.site_restrictions) {
    if (curY > pageHeight - 45) {
      doc.addPage();
      curY = 16;
    }

    doc.setFillColor(...COLOR_LIGHT_BG);
    doc.setDrawColor(...COLOR_BORDER);
    doc.roundedRect(marginX, curY, contentWidth, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_CHARCOAL);
    doc.text('NOTAS Y RECOMENDACIONES DE PROCESAMIENTO:', marginX + 4, curY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLOR_MUTED);

    const notesText = [
      report.anomalies_notes ? `Anomalías: ${report.anomalies_notes}` : '',
      report.site_restrictions ? `Restricciones: ${report.site_restrictions}` : '',
      report.processing_recommendations ? `CAD/Gabinete: ${report.processing_recommendations}` : '',
    ].filter(Boolean).join(' | ');

    const splitNotes = doc.splitTextToSize(notesText || 'Sin observaciones adicionales.', contentWidth - 8);
    doc.text(splitNotes, marginX + 4, curY + 9);

    curY += 22;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. REGISTRO FOTOGRÁFICO DE CAMPO
  // ─────────────────────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) {
    if (curY > pageHeight - 75) {
      doc.addPage();
      curY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_CHARCOAL);
    doc.text('REGISTRO FOTOGRÁFICO DE EVIDENCIAS EN SITIO', marginX, curY + 2);
    curY += 5;

    const photoWidth = (contentWidth - 6) / 2; // ~90 mm
    const photoHeight = 52; // mm

    for (let i = 0; i < photos.length; i += 2) {
      if (curY + photoHeight + 10 > pageHeight - 20) {
        doc.addPage();
        curY = 16;
      }

      // Foto 1
      const photo1 = photos[i];
      if (photo1?.base64) {
        try {
          doc.addImage(photo1.base64, 'JPEG', marginX, curY, photoWidth, photoHeight);
          doc.setDrawColor(...COLOR_BORDER);
          doc.rect(marginX, curY, photoWidth, photoHeight, 'D');

          // Pie de foto
          doc.setFillColor(...COLOR_CHARCOAL);
          doc.rect(marginX, curY + photoHeight - 6, photoWidth, 6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          const caption1 = (photo1.caption || photo1.original_name || 'Registro fotográfico de campo').substring(0, 55);
          doc.text(caption1, marginX + 2, curY + photoHeight - 2);
        } catch (imgErr) {
          console.warn('Error renderizando foto 1 en PDF:', imgErr);
        }
      }

      // Foto 2 (si existe)
      if (i + 1 < photos.length) {
        const photo2 = photos[i + 1];
        const photo2X = marginX + photoWidth + 6;
        if (photo2?.base64) {
          try {
            doc.addImage(photo2.base64, 'JPEG', photo2X, curY, photoWidth, photoHeight);
            doc.setDrawColor(...COLOR_BORDER);
            doc.rect(photo2X, curY, photoWidth, photoHeight, 'D');

            // Pie de foto
            doc.setFillColor(...COLOR_CHARCOAL);
            doc.rect(photo2X, curY + photoHeight - 6, photoWidth, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            const caption2 = (photo2.caption || photo2.original_name || 'Registro fotográfico de campo').substring(0, 55);
            doc.text(caption2, photo2X + 2, curY + photoHeight - 2);
          } catch (imgErr) {
            console.warn('Error renderizando foto 2 en PDF:', imgErr);
          }
        }
      }

      curY += photoHeight + 8;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. PIE DE PÁGINA Y VALIDACIÓN TÉCNICA
  // ─────────────────────────────────────────────────────────────────────────────
  if (curY > pageHeight - 32) {
    doc.addPage();
    curY = 16;
  }

  const signY = Math.max(curY + 4, pageHeight - 28);

  // Línea divisoria
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(marginX, signY, marginX + contentWidth, signY);

  // Firma / Responsabilidad Localizador
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text(`ELABORADO POR: ${report.localizador_name.toUpperCase()}`, marginX, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Localizador Especialista de Campo — División GPR', marginX, signY + 9);

  // Firma / Supervisión Técnica
  const signRightX = marginX + 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_CHARCOAL);
  doc.text('REVISIÓN TÉCNICA & GABINETE CAD/BIM', signRightX, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('PROCIMEC Mapping e Ingeniería — Validación Digital', signRightX, signY + 9);

  // Barra inferior de certificación
  doc.setFillColor(...COLOR_CHARCOAL);
  doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
  doc.setTextColor(...COLOR_AMBER);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('PROCIMEC S.A.S. — PLATAFORMA INTEGRAL DE GEOFÍSICA Y EXPLORACIÓN SUBTERRÁNEA', marginX, pageHeight - 2.2);

  // Generar buffer
  const cleanProject = (project.name || 'Proyecto').replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 20);
  const cleanDate = (report.report_date || new Date().toISOString().split('T')[0]).replace(/[^0-9\-]/g, '');
  const fileName = `Reporte_Diario_GPR_${cleanProject}_${cleanDate}.pdf`;

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(pdfArrayBuffer);
  const pdfBase64 = pdfBuffer.toString('base64');

  return {
    fileName,
    pdfBuffer,
    pdfBase64,
  };
}
