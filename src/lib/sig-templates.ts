import https from 'https';
import type { jsPDF } from 'jspdf';

export const SIG_CHANGE_TEMPLATE_DRIVE_ID =
  process.env.GOOGLE_DRIVE_SIG_CHANGE_TEMPLATE_ID || '1wTRLk90fdyMPoDywI0hLYC3O4-ekDlyq';

export interface SigChangeWorkTeamMember {
  nombre: string;
  cargo: string;
  proceso: string;
}

export interface SigChangeRisk {
  descripcion_efectos: string;
  tipo: 'Amenaza' | 'Oportunidad';
  controles_acciones: string;
}

export interface SigChangeActivity {
  actividad: string;
  responsable: string;
  fecha_limite: string;
  producto_esperado: string;
}

export interface SigChangeData {
  id?: string;
  official_code?: string;
  version?: string;
  identifier_name: string;
  identifier_position: string;
  identifier_process: string;
  identification_date: string;
  change_description: string;
  justification: string;
  affected_processes: string;
  origins: string[];
  origins_other?: string;
  work_team: SigChangeWorkTeamMember[];
  risks: SigChangeRisk[];
  activities: SigChangeActivity[];
  approval_name?: string;
  approval_position?: string;
  approval_process?: string;
  approval_signature?: string;
  tracking_name?: string;
  tracking_position?: string;
  tracking_process?: string;
  tracking_signature?: string;
  control_risks_controlled?: boolean | null;
  change_effective?: boolean | null;
  effectiveness_notes_no?: string;
}

// ─── Cache en memoria para proteger cuotas y garantizar velocidad ────────────
let cachedTemplateBuffer: Buffer | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché en memoria

/**
 * Descarga en caliente la plantilla viva desde Google Drive.
 * Si el archivo en Drive se modifica, al vencer el TTL se obtiene la versión actualizada sin redesplegar.
 */
export async function fetchSigTemplateBuffer(fileId: string = SIG_CHANGE_TEMPLATE_DRIVE_ID, forceRefresh = false): Promise<Buffer> {
  const now = Date.now();
  if (!forceRefresh && cachedTemplateBuffer && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedTemplateBuffer;
  }

  // 1. Intentar descargar mediante Google Drive API si las credenciales están configuradas
  try {
    const { getDriveClient } = await import('./hseq-drive');
    const drive = await getDriveClient();
    const downloadRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    if (downloadRes.data) {
      const buffer = Buffer.from(downloadRes.data as ArrayBuffer);
      cachedTemplateBuffer = buffer;
      lastFetchTimestamp = now;
      return buffer;
    }
  } catch (apiErr) {
    console.warn('Descarga por Google Drive API no disponible o sin permisos directos, usando enlace compartido:', apiErr);
  }

  // 2. Fallback de alta velocidad: Descarga HTTP directa del enlace compartido público / con acceso de visualización
  const downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    function fetchUrl(targetUrl: string, maxRedirects = 5) {
      if (maxRedirects <= 0) return reject(new Error('Demasiadas redirecciones en Google Drive'));

      https.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, maxRedirects - 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Respuesta HTTP inesperada de Google Drive: ${res.statusCode}`));
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    }

    fetchUrl(downloadUrl);
  });

  cachedTemplateBuffer = buffer;
  lastFetchTimestamp = now;
  return buffer;
}

/**
 * Llenado dinámico del archivo Excel utilizando las marcas oficiales del formato:
 * {{ nombre }}, {{ cargo }}, {{ fecha_identificacion }}, arrays dinámicos y marcas de verificación.
 */
export async function fillSigChangeExcel(templateBuffer: Buffer, data: SigChangeData): Promise<Buffer> {
  const ExcelJSModule = await import('exceljs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('La plantilla Excel no contiene hojas de cálculo.');
  }

  // Diccionario de marcas simples de reemplazo
  const originsSet = new Set(data.origins.map((o) => o.toLowerCase().trim()));

  const originKeys = [
    'direccionamiento',
    'nuevos_proyectos',
    'estructura_org',
    'legislacion',
    'procesos_sig',
    'normas_sig',
    'alcance_sig',
    'innovacion',
    'prestacion_servicio',
    'partes_interesadas',
    'instalaciones_equipos',
    'riesgos_oportunidades',
    'implementacion_mejoras',
    'contexto_interno_externo',
    'adecuaciones_trabajo',
    'conocimiento_ssta',
    'otro',
  ];

  const singlePlaceholders: Record<string, string> = {
    'nombre': data.identifier_name || '',
    'cargo': data.identifier_position || '',
    'fecha_identificacion': data.identification_date || '',
    'proceso_identificacion': data.identifier_process || '',
    'descripcion_cambio': data.change_description || '',
    'justificacion_cambio': data.justification || '',
    'procesos_afectados': data.affected_processes || '',
    'origen_cual': data.origins_other || '',
    'aprobacion_nombre': data.approval_name || '',
    'aprobacion_cargo': data.approval_position || '',
    'aprobacion_proceso': data.approval_process || '',
    'aprobacion_firma': data.approval_signature || (data.approval_name ? 'Aprobado digitalmente' : ''),
    'seguimiento_nombre': data.tracking_name || '',
    'seguimiento_cargo': data.tracking_position || '',
    'seguimiento_proceso': data.tracking_process || '',
    'seguimiento_firma': data.tracking_signature || (data.tracking_name ? 'En seguimiento' : ''),
    'control_riesgos_si': data.control_risks_controlled === true ? 'X' : '',
    'control_riesgos_no': data.control_risks_controlled === false ? 'X' : '',
    'efectividad_cambio_si': data.change_effective === true ? 'X' : '',
    'efectividad_cambio_no': data.change_effective === false ? 'X' : '',
    'efectividad_observaciones_no': data.effectiveness_notes_no || '',
  };

  // Asignar orígenes de cambio con 'X'
  for (const k of originKeys) {
    const isSelected = originsSet.has(k) || originsSet.has(`origen_${k}`);
    singlePlaceholders[`origen_${k}`] = isSelected ? 'X' : '';
  }

  // 1. Reemplazar marcadores celda por celda
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worksheet.eachRow((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell((cell: any) => {
      if (cell.value && typeof cell.value === 'string') {
        let text = cell.value;

        // Marcadores de array indexados directamente en la plantilla:
        // {{ equipo_trabajo[0].nombre }}, etc.
        text = text.replace(/\{\{\s*equipo_trabajo\[0\]\.nombre\s*\}\}/g, data.work_team[0]?.nombre || '');
        text = text.replace(/\{\{\s*equipo_trabajo\[0\]\.cargo\s*\}\}/g, data.work_team[0]?.cargo || '');
        text = text.replace(/\{\{\s*equipo_trabajo\[0\]\.proceso\s*\}\}/g, data.work_team[0]?.proceso || '');

        text = text.replace(/\{\{\s*riesgos\[0\]\.descripcion_efectos\s*\}\}/g, data.risks[0]?.descripcion_efectos || '');
        text = text.replace(/\{\{\s*riesgos\[0\]\.tipo\s*\}\}/g, data.risks[0]?.tipo || '');
        text = text.replace(/\{\{\s*riesgos\[0\]\.controles_acciones\s*\}\}/g, data.risks[0]?.controles_acciones || '');

        text = text.replace(/\{\{\s*actividades\[0\]\.actividad\s*\}\}/g, data.activities[0]?.actividad || '');
        text = text.replace(/\{\{\s*actividades\[0\]\.responsable\s*\}\}/g, data.activities[0]?.responsable || '');
        text = text.replace(/\{\{\s*actividades\[0\]\.fecha_limite\s*\}\}/g, data.activities[0]?.fecha_limite || '');
        text = text.replace(/\{\{\s*actividades\[0\]\.producto_esperado\s*\}\}/g, data.activities[0]?.producto_esperado || '');

        // Marcadores individuales
        for (const [key, val] of Object.entries(singlePlaceholders)) {
          const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          text = text.replace(pattern, val);
        }

        if (text !== cell.value) {
          cell.value = text;
        }
      }
    });
  });

  // 2. Si hay múltiples elementos en el equipo de trabajo, riesgos o actividades, expandir las tablas
  // Insertar miembros del equipo de trabajo adicionales (índice 1 en adelante)
  if (data.work_team.length > 1) {
    let teamRowIndex = -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worksheet.eachRow((r: any, rNum: number) => {
      const v = String(r.getCell(1).value || '');
      if (v === data.work_team[0]?.nombre || v.includes('equipo_trabajo')) {
        teamRowIndex = rNum;
      }
    });

    if (teamRowIndex !== -1) {
      for (let i = 1; i < data.work_team.length; i++) {
        const item = data.work_team[i];
        const newRow = worksheet.insertRow(teamRowIndex + i, [item.nombre, item.cargo, item.proceso]);
        newRow.height = 20;
        newRow.font = { name: 'Calibri', size: 10 };
      }
    }
  }

  // Insertar riesgos adicionales (índice 1 en adelante)
  if (data.risks.length > 1) {
    let riskRowIndex = -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worksheet.eachRow((r: any, rNum: number) => {
      const v = String(r.getCell(1).value || '');
      if (v === data.risks[0]?.descripcion_efectos || v.includes('riesgos[')) {
        riskRowIndex = rNum;
      }
    });

    if (riskRowIndex !== -1) {
      for (let i = 1; i < data.risks.length; i++) {
        const item = data.risks[i];
        const newRow = worksheet.insertRow(riskRowIndex + i, [item.descripcion_efectos, item.tipo, item.controles_acciones]);
        newRow.height = 22;
        newRow.font = { name: 'Calibri', size: 10 };
      }
    }
  }

  // Insertar actividades adicionales (índice 1 en adelante)
  if (data.activities.length > 1) {
    let actRowIndex = -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worksheet.eachRow((r: any, rNum: number) => {
      const v = String(r.getCell(1).value || '');
      if (v === data.activities[0]?.actividad || v.includes('actividades[')) {
        actRowIndex = rNum;
      }
    });

    if (actRowIndex !== -1) {
      for (let i = 1; i < data.activities.length; i++) {
        const item = data.activities[i];
        const newRow = worksheet.insertRow(actRowIndex + i, [item.actividad, item.responsable, item.fecha_limite, item.producto_esperado]);
        newRow.height = 22;
        newRow.font = { name: 'Calibri', size: 10 };
      }
    }
  }

  // 3. Limpieza final de cualquier etiqueta residual {{ ... }}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worksheet.eachRow((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell((cell: any) => {
      if (typeof cell.value === 'string' && cell.value.includes('{{')) {
        cell.value = cell.value.replace(/\{\{\s*[^}]+\s*\}\}/g, '').trim();
      }
    });
  });

  const outputBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(outputBuffer);
}

/**
 * Genera el documento PDF formal institucional con tipografía bimodal y colores corporativos PROCIMEC.
 */
export async function generateSigChangePdf(data: SigChangeData): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 14;

  // ─── ENCABEZADO INSTITUCIONAL PROCIMEC / PCM CLOUD ──────────────────────────
  doc.setFillColor(30, 34, 41); // #1E2229 Carbón Técnico
  doc.rect(margin, currentY, contentWidth, 22, 'F');

  // Línea de acento Ámbar Geofísico
  doc.setFillColor(234, 160, 35); // #EAA023 Ámbar
  doc.rect(margin, currentY + 21, contentWidth, 1.2, 'F');

  // Título e Identidad
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PROCIMEC  |  PCM CLOUD - SISTEMA INTEGRADO DE GESTIÓN', margin + 4, currentY + 7);

  doc.setFontSize(12);
  doc.text('ANÁLISIS Y PLANIFICACIÓN DE LOS CAMBIOS QUE AFECTEN AL SIG', margin + 4, currentY + 14);

  // Metadatos a la derecha (código y versión en JetBrains Mono style)
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(234, 160, 35);
  doc.text(data.official_code || 'FOR-SIG-001', pageWidth - margin - 4, currentY + 7, { align: 'right' });
  doc.setTextColor(200, 205, 215);
  doc.setFontSize(8);
  doc.text(`Versión: ${data.version || '1'}  |  ${data.identification_date || '2026-10-01'}`, pageWidth - margin - 4, currentY + 14, { align: 'right' });

  currentY += 27;

  // Helper para secciones
  function drawSectionHeader(title: string, yPos: number): number {
    doc.setFillColor(42, 48, 60); // #2A303C Grafito
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setTextColor(234, 160, 35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin + 3, yPos + 4.8);
    return yPos + 8;
  }

  // ─── 1. IDENTIFICACIÓN Y ANÁLISIS DEL CAMBIO ────────────────────────────────
  currentY = drawSectionHeader('1. IDENTIFICACIÓN Y ANÁLISIS DEL CAMBIO', currentY);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 34, 41] },
    headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
    body: [
      [
        { content: 'Persona que Identifica:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.identifier_name || '-' },
        { content: 'Cargo:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.identifier_position || '-' },
      ],
      [
        { content: 'Proceso:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.identifier_process || '-' },
        { content: 'Fecha:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.identification_date || '-', styles: { font: 'courier' } },
      ],
      [
        { content: 'Descripción del Cambio:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.change_description || '-', colSpan: 3 },
      ],
      [
        { content: 'Justificación del Cambio:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.justification || '-', colSpan: 3 },
      ],
      [
        { content: 'Procesos Afectados:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.affected_processes || '-', colSpan: 3 },
      ],
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Orígenes del Cambio
  const ORIGIN_LABELS: Record<string, string> = {
    direccionamiento: 'Cambios en el direccionamiento estratégico',
    nuevos_proyectos: 'Nuevos proyectos',
    estructura_org: 'Cambios en la estructura organizacional',
    legislacion: 'Cambios en la legislación',
    procesos_sig: 'Cambios en los procesos del SIG',
    normas_sig: 'Actualización normas SIG',
    alcance_sig: 'Cambio en el alcance del SIG',
    innovacion: 'Innovación',
    prestacion_servicio: 'Cambios en la prestación del servicio',
    partes_interesadas: 'Necesidades/expectativas partes interesadas',
    instalaciones_equipos: 'Modificaciones en Instalaciones/equipos',
    riesgos_oportunidades: 'Riesgos y/u oportunidades identificados',
    implementacion_mejoras: 'Implementación de mejoras',
    contexto_interno_externo: 'Modificaciones en contexto interno o externo',
    adecuaciones_trabajo: 'Adecuaciones sitios de trabajo',
    conocimiento_ssta: 'Cambios en el conocimiento en SSTA',
    otro: 'Otro origen',
  };

  const selectedOriginsText =
    data.origins && data.origins.length > 0
      ? data.origins
          .map((o) => ORIGIN_LABELS[o.replace(/^origen_/, '')] || o)
          .join('  •  ') + (data.origins_other ? ` (Detalle: ${data.origins_other})` : '')
      : 'Ninguno especificado';

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        { content: 'Orígenes del Cambio Detectados:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250], width: 45 } },
        { content: selectedOriginsText },
      ],
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ─── 2. EQUIPO DE TRABAJO PARA EL CAMBIO ────────────────────────────────────
  currentY = drawSectionHeader('2. EQUIPO DE TRABAJO PARA EL CAMBIO', currentY);

  const teamRows = (data.work_team || []).map((m, i) => [
    String(i + 1),
    m.nombre || '-',
    m.cargo || '-',
    m.proceso || '-',
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['#', 'Nombre', 'Cargo', 'Proceso']],
    body: teamRows.length > 0 ? teamRows : [['1', 'No registrado', '-', '-']],
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ─── 3. ANÁLISIS DE RIESGOS Y OPORTUNIDADES ─────────────────────────────────
  currentY = drawSectionHeader('3. ANÁLISIS DEL CAMBIO (RIESGOS Y OPORTUNIDADES ASOCIADOS)', currentY);

  const riskRows = (data.risks || []).map((r, i) => [
    String(i + 1),
    r.descripcion_efectos || '-',
    r.tipo || 'Amenaza',
    r.controles_acciones || '-',
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['#', 'Descripción de Efectos Potenciales', 'Tipo', 'Controles / Acciones a Tomar']],
    body: riskRows.length > 0 ? riskRows : [['1', 'Sin riesgos registrados', 'Amenaza', '-']],
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Revisar si requiere nueva página antes del Plan de Trabajo
  if (currentY > 210) {
    doc.addPage();
    currentY = 14;
  }

  // ─── 4. IMPLEMENTACIÓN DEL CAMBIO (ACTIVIDADES) ─────────────────────────────
  currentY = drawSectionHeader('4. IMPLEMENTACIÓN DEL CAMBIO (PLAN DE ACTIVIDADES)', currentY);

  const activityRows = (data.activities || []).map((a, i) => [
    String(i + 1),
    a.actividad || '-',
    a.responsable || '-',
    a.fecha_limite || '-',
    a.producto_esperado || '-',
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['#', 'Actividad', 'Responsable', 'Fecha Límite', 'Producto Esperado']],
    body: activityRows.length > 0 ? activityRows : [['1', 'Sin actividades registradas', '-', '-', '-']],
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 26, font: 'courier' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Revisar si requiere nueva página para firmas y efectividad
  if (currentY > 220) {
    doc.addPage();
    currentY = 14;
  }

  // ─── 5. APROBACIÓN Y SEGUIMIENTO DEL CAMBIO ─────────────────────────────────
  currentY = drawSectionHeader('5. APROBACIÓN Y SEGUIMIENTO DEL CAMBIO', currentY);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [42, 48, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Rol', 'Nombre Completo', 'Cargo', 'Proceso', 'Firma / Estado']],
    body: [
      [
        'Aprobación:',
        data.approval_name || 'Pendiente de aprobación',
        data.approval_position || '-',
        data.approval_process || '-',
        data.approval_signature || (data.approval_name ? 'Firmado Digitalmente' : 'Pendiente'),
      ],
      [
        'Seguimiento:',
        data.tracking_name || 'Designado por el SIG',
        data.tracking_position || '-',
        data.tracking_process || '-',
        data.tracking_signature || (data.tracking_name ? 'Registrado' : 'Pendiente'),
      ],
    ],
    columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold', fillColor: [245, 247, 250] } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ─── 6. EVALUACIÓN DE EFECTIVIDAD DEL CAMBIO ────────────────────────────────
  currentY = drawSectionHeader('6. EFECTIVIDAD DEL CAMBIO (CIERRE PHVA)', currentY);

  const controlTxt =
    data.control_risks_controlled === true
      ? 'SÍ (Riesgos controlados adecuadamente)'
      : data.control_risks_controlled === false
      ? 'NO (Se presentaron desviaciones no previstas)'
      : 'Pendiente de evaluación';

  const effTxt =
    data.change_effective === true
      ? 'SÍ (El cambio cumplió con los objetivos esperados)'
      : data.change_effective === false
      ? 'NO (No alcanzó el resultado esperado - Acciones de mejora requeridas)'
      : 'Pendiente de evaluación';

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    body: [
      [
        { content: '¿Se controlaron los riesgos generados por el cambio?', styles: { fontStyle: 'bold', fillColor: [245, 247, 250], width: 75 } },
        { content: controlTxt },
      ],
      [
        { content: 'Efectividad General del Cambio:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: effTxt },
      ],
      [
        { content: 'Observaciones / Plan de Acción Correctivo (si aplica):', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
        { content: data.effectiveness_notes_no || 'Ninguna observación adicional registrada.' },
      ],
    ],
  });

  // ─── PIE DE PÁGINA INSTITUCIONAL ───────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 125, 135);

    doc.line(margin, 287, pageWidth - margin, 287);
    doc.text('PROCIMEC  •  PCM CLOUD  •  Sistema Integrado de Gestión HSEQ & Calidad', margin, 291);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 291, { align: 'right' });
  }

  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}
