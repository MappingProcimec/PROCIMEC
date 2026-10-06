import https from 'https';
import { CORPORATE_LOGO_BASE64 } from './gpr/logoBase64';

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
  effective_date?: string;
  identifier_name: string;
  identifier_position: string;
  identifier_process: string;
  identification_date: string;
  change_description: string;
  justification: string;
  affected_processes: string;
  required_elements?: string[] | string;
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

export function formatRequiredElements(val: unknown): string {
  if (Array.isArray(val)) {
    return val.filter(Boolean).join(', ');
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).join(', ');
        }
      } catch {
        // mantener trimmed
      }
    }
    return trimmed;
  }
  return '';
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
    'elementos_cambio': formatRequiredElements(data.required_elements),
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

  // 1. Identificar filas de plantillas para tablas dinámicas ANTES de reemplazar
  let actRowIdx = -1;
  let riskRowIdx = -1;
  let teamRowIdx = -1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worksheet.eachRow((row: any, rNum: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell((cell: any) => {
      const v = String(cell.value || '');
      if (v.includes('actividades[0]')) actRowIdx = rNum;
      if (v.includes('riesgos[0]')) riskRowIdx = rNum;
      if (v.includes('equipo_trabajo[0]')) teamRowIdx = rNum;
    });
  });

  // Helper para insertar filas clonando fielmente el formato de la fila modelo de Excel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertStyledRow = (insertAtIdx: number, modelRowNumber: number, cellValues: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelRow = worksheet.getRow(modelRowNumber);
    const newRow = worksheet.insertRow(insertAtIdx, cellValues);
    newRow.height = modelRow.height || 15.75;

    for (let c = 1; c <= 4; c++) {
      const modelCell = modelRow.getCell(c);
      const newCell = newRow.getCell(c);
      if (modelCell.font) newCell.font = JSON.parse(JSON.stringify(modelCell.font));
      if (modelCell.alignment) newCell.alignment = JSON.parse(JSON.stringify(modelCell.alignment));
      if (modelCell.border) newCell.border = JSON.parse(JSON.stringify(modelCell.border));
      if (modelCell.fill) newCell.fill = JSON.parse(JSON.stringify(modelCell.fill));
      newCell.numFmt = '@';
    }
    return newRow;
  };

  // 2. Expansión dinámica de tablas DE ABAJO HACIA ARRIBA (bottom-to-top)
  // Esto garantiza que la inserción de filas no desplace los índices de las secciones superiores.

  // 2a. Expansión del Plan de Actividades
  if (actRowIdx !== -1 && data.activities.length > 0) {
    if (data.activities.length > 1) {
      for (let i = 1; i < data.activities.length; i++) {
        const item = data.activities[i];
        insertStyledRow(actRowIdx + i, actRowIdx, [
          item.actividad || '',
          item.responsable || '',
          item.fecha_limite || '',
          item.producto_esperado || '',
        ]);
      }
    }
  }

  // 2b. Expansión del Análisis de Riesgos y Oportunidades
  if (riskRowIdx !== -1 && data.risks.length > 0) {
    if (data.risks.length > 1) {
      for (let i = 1; i < data.risks.length; i++) {
        const item = data.risks[i];
        insertStyledRow(riskRowIdx + i, riskRowIdx, [
          item.descripcion_efectos || '',
          item.tipo || 'Amenaza',
          item.controles_acciones || '',
          '',
        ]);
      }
    }
  }

  // 2c. Expansión del Equipo de Trabajo
  if (teamRowIdx !== -1 && data.work_team.length > 0) {
    if (data.work_team.length > 1) {
      for (let i = 1; i < data.work_team.length; i++) {
        const item = data.work_team[i];
        insertStyledRow(teamRowIdx + i, teamRowIdx, [
          item.nombre || '',
          item.cargo || '',
          item.proceso || '',
          '',
        ]);
      }
    }
  }

  // Corrección explícita de formato en la celda D7 (justificación del cambio):
  // Forzar texto puro '@' para remover cualquier formato de fecha 'd-mmm-yy' heredado de la plantilla original
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worksheet.eachRow((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell((cell: any) => {
      const v = String(cell.value || '');
      if (v.includes('justificacion_cambio') || cell.address === 'D7') {
        cell.numFmt = '@';
      }
    });
  });

  // 3. Reemplazo de marcadores celda por celda (incluyendo el índice [0] de cada tabla)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worksheet.eachRow((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell((cell: any) => {
      if (cell.value && typeof cell.value === 'string') {
        let text = cell.value;

        // Primer elemento de arrays
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

  // 4. Inserción de Firmas Digitales en Excel (si se proporcionó imagen Base64)
  let approvalSignCell: { row: number; col: number } | null = null;
  let trackingSignCell: { row: number; col: number } | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worksheet.eachRow((row: any, rNum: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell((cell: any, cNum: number) => {
      const v = String(cell.value || '');
      if (v.includes('aprobacion_firma') || (data.approval_signature && v === data.approval_signature)) {
        approvalSignCell = { row: rNum, col: cNum };
      }
      if (v.includes('seguimiento_firma') || (data.tracking_signature && v === data.tracking_signature)) {
        trackingSignCell = { row: rNum, col: cNum };
      }
    });
  });

  if (approvalSignCell && data.approval_signature?.startsWith('data:image')) {
    try {
      const targetCell = approvalSignCell as { row: number; col: number };
      worksheet.getCell(targetCell.row, targetCell.col).value = '';
      worksheet.getRow(targetCell.row).height = Math.max(worksheet.getRow(targetCell.row).height || 0, 48);

      const signBase64 = data.approval_signature.split(',')[1];
      const signBuffer = Buffer.from(signBase64, 'base64');
      const signImgId = workbook.addImage({ buffer: signBuffer, extension: 'png' });

      worksheet.addImage(signImgId, {
        tl: { col: targetCell.col - 1 + 0.1, row: targetCell.row - 1 + 0.1 },
        br: { col: targetCell.col - 1 + 0.9, row: targetCell.row - 1 + 0.9 },
        editAs: 'oneCell',
      });
    } catch (signErr) {
      console.warn('Error estampando firma de aprobación en Excel:', signErr);
    }
  }

  if (trackingSignCell && data.tracking_signature?.startsWith('data:image')) {
    try {
      const targetCell = trackingSignCell as { row: number; col: number };
      worksheet.getCell(targetCell.row, targetCell.col).value = '';
      worksheet.getRow(targetCell.row).height = Math.max(worksheet.getRow(targetCell.row).height || 0, 48);

      const signBase64 = data.tracking_signature.split(',')[1];
      const signBuffer = Buffer.from(signBase64, 'base64');
      const signImgId = workbook.addImage({ buffer: signBuffer, extension: 'png' });

      worksheet.addImage(signImgId, {
        tl: { col: targetCell.col - 1 + 0.1, row: targetCell.row - 1 + 0.1 },
        br: { col: targetCell.col - 1 + 0.9, row: targetCell.row - 1 + 0.9 },
        editAs: 'oneCell',
      });
    } catch (signErr) {
      console.warn('Error estampando firma de seguimiento en Excel:', signErr);
    }
  }

  // 5. Limpieza final de cualquier etiqueta residual {{ ... }}
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
 * Genera el documento PDF como el espejo visual y estructural fiel del archivo Excel oficial (FOR-SIG-001).
 * Orientación horizontal (Landscape A4), franjas doradas institucionales (#FFC000),
 * subfranjas grises (#D8D8D8), cuadrícula de 4 columnas, casillas [X] y estampado de firmas digitales en celda.
 */
export async function generateSigChangePdf(data: SigChangeData): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableModule as any).default || autoTableModule;

  // Orientación horizontal idéntica a la configuración de página del Excel oficial (A4 Landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 269 mm
  let currentY = 10;

  // Proporciones de columnas exactas del Excel (80mm, 56mm, 65mm, 68mm = 269mm)
  const colWidths = [80, 56, 65, 68];

  // ─── 0. ENCABEZADO OFICIAL DE EXCEL ──────────────────────────────────────────
  // ─── 0. ENCABEZADO OFICIAL DE EXCEL CON LOGO INSTITUCIONAL ─────────────────
  // Bloque unificado de 3 recuadros idéntico a las filas 1-3 del Excel oficial:
  // [ LOGOTIPO INSTITUCIONAL ] [ TÍTULO OFICIAL ] [ CÓDIGO / VERSIÓN / FECHA ]
  const headerHeight = 16;
  const logoWidth = 56;
  const metaWidth = 50;
  const titleWidth = contentWidth - logoWidth - metaWidth; // 269 - 56 - 50 = 163mm

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // 1. Recuadro izquierdo: Logotipo Institucional
  doc.rect(margin, currentY, logoWidth, headerHeight);
  try {
    doc.addImage(CORPORATE_LOGO_BASE64, 'PNG', margin + 3, currentY + 2, logoWidth - 6, headerHeight - 4);
  } catch (err) {
    console.warn('Error dibujando logotipo en PDF:', err);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PROCIMEC', margin + logoWidth / 2, currentY + headerHeight / 2 + 1, { align: 'center' });
  }

  // 2. Recuadro central: Título del Formato Oficial
  doc.rect(margin + logoWidth, currentY, titleWidth, headerHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('FORMATO DE ANÁLISIS Y PLANIFICACIÓN DE', margin + logoWidth + titleWidth / 2, currentY + 6.5, { align: 'center' });
  doc.text('LOS CAMBIOS QUE AFECTEN AL SIG', margin + logoWidth + titleWidth / 2, currentY + 11.5, { align: 'center' });

  // 3. Recuadro derecho: Metadatos del Documento
  doc.rect(margin + logoWidth + titleWidth, currentY, metaWidth, headerHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Código: ${data.official_code || 'FOR-SIG-001'}`, margin + logoWidth + titleWidth + 3, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Versión: ${data.version || '1'}`, margin + logoWidth + titleWidth + 3, currentY + 9.5);
  doc.text(`Fecha: ${data.effective_date || '2026-10-01'}`, margin + logoWidth + titleWidth + 3, currentY + 14);

  currentY += headerHeight + 4;

  // Orígenes normalizados
  const originsSet = new Set((data.origins || []).map((o) => o.toLowerCase().trim()));
  const isOrigChecked = (key: string) => originsSet.has(key) || originsSet.has(`origen_${key}`);
  const box = (checked: boolean) => (checked ? '[X]' : '[  ]');

  // Arrays de orígenes en dos columnas exactas a las filas 10-18 de Excel
  const originsList = [
    { leftKey: 'direccionamiento', leftLabel: 'Cambios en el direccionamiento estratégico', rightKey: 'nuevos_proyectos', rightLabel: 'Nuevos proyectos' },
    { leftKey: 'estructura_org', leftLabel: 'Cambios en la estructura organizacional', rightKey: 'legislacion', rightLabel: 'Cambios en la legislación' },
    { leftKey: 'procesos_sig', leftLabel: 'Cambios en los procesos del SIG', rightKey: 'normas_sig', rightLabel: 'Actualización normas SIG' },
    { leftKey: 'alcance_sig', leftLabel: 'Cambio en el alcance del SIG', rightKey: 'innovacion', rightLabel: 'Innovación' },
    { leftKey: 'prestacion_servicio', leftLabel: 'Cambios en la prestación del servicio', rightKey: 'partes_interesadas', rightLabel: 'Necesidades/expectativas partes interesadas' },
    { leftKey: 'instalaciones_equipos', leftLabel: 'Modificaciones en Instalaciones/equipos', rightKey: 'riesgos_oportunidades', rightLabel: 'Riesgos y/u oportunidades identificados' },
    { leftKey: 'implementacion_mejoras', leftLabel: 'Implementación de mejoras', rightKey: 'contexto_interno_externo', rightLabel: 'Modificaciones en contexto interno o externo' },
    { leftKey: 'adecuaciones_trabajo', leftLabel: 'Adecuaciones sitios de trabajo', rightKey: 'conocimiento_ssta', rightLabel: 'Cambios en el conocimiento en SSTA' },
    { leftKey: 'otro', leftLabel: 'Otro', rightKey: 'cual', rightLabel: `¿Cuál?  ${data.origins_other || ''}` },
  ];

  // Construcción de la tabla completa de celdas idéntica al Excel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyRows: any[] = [];
  let approvalSignRowIdx = -1;
  let trackingSignRowIdx = -1;

  // 1. SECCIÓN 1: IDENTIFICACIÓN Y ANÁLISIS DEL CAMBIO (Fila dorada #FFC000)
  bodyRows.push([
    {
      content: '1. IDENTIFICACIÓN Y ANÁLISIS DEL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [255, 192, 0], fontStyle: 'bold', fontSize: 9, halign: 'left', minCellHeight: 6.5 },
    },
  ]);

  bodyRows.push([
    { content: 'Nombre de la persona que identifica el cambio:', styles: { fontStyle: 'bold' } },
    { content: data.identifier_name || '', styles: { halign: 'center' } },
    { content: 'Cargo:', styles: { fontStyle: 'bold' } },
    { content: data.identifier_position || '', styles: { halign: 'center' } },
  ]);

  bodyRows.push([
    { content: 'Fecha:', styles: { fontStyle: 'bold' } },
    { content: data.identification_date || '', styles: { halign: 'center', font: 'courier' } },
    { content: 'Proceso:', styles: { fontStyle: 'bold' } },
    { content: data.identifier_process || '', styles: { halign: 'center' } },
  ]);

  bodyRows.push([
    { content: 'Descripción del cambio, Fecha estimada:', styles: { fontStyle: 'bold' } },
    { content: data.change_description || '', styles: { halign: 'left' } },
    { content: 'Justificación del cambio:', styles: { fontStyle: 'bold' } },
    { content: data.justification || '', styles: { halign: 'left' } },
  ]);

  const elementsTxt = formatRequiredElements(data.required_elements);

  bodyRows.push([
    { content: 'Procesos afectados por el cambio:', styles: { fontStyle: 'bold' } },
    { content: data.affected_processes || '', styles: { halign: 'left' } },
    { content: 'Elementos requeridos para el cambio:', styles: { fontStyle: 'bold' } },
    { content: elementsTxt, styles: { halign: 'left' } },
  ]);

  // Subfranja gris de Origen del Cambio (#D8D8D8)
  bodyRows.push([
    {
      content: 'ORIGEN DEL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [216, 216, 216], fontStyle: 'bold', fontSize: 8.5, halign: 'left', minCellHeight: 6 },
    },
  ]);

  // Filas de orígenes en 2 columnas
  for (const o of originsList) {
    const isOther = o.leftKey === 'otro';
    const leftChecked = isOrigChecked(o.leftKey);
    const rightChecked = isOther ? false : isOrigChecked(o.rightKey);

    bodyRows.push([
      { content: o.leftLabel, styles: { fontSize: 7.5 } },
      { content: box(leftChecked), styles: { halign: 'center', font: 'courier', fontStyle: 'bold', fontSize: 8.5 } },
      { content: o.rightLabel, styles: { fontSize: 7.5 } },
      { content: isOther ? '' : box(rightChecked), styles: { halign: 'center', font: 'courier', fontStyle: 'bold', fontSize: 8.5 } },
    ]);
  }

  // 2. SECCIÓN 2: EQUIPO DE TRABAJO (Fila dorada #FFC000)
  bodyRows.push([
    {
      content: '2. EQUIPO DE TRABAJO PARA EL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [255, 192, 0], fontStyle: 'bold', fontSize: 9, halign: 'left', minCellHeight: 6.5 },
    },
  ]);

  bodyRows.push([
    { content: 'NOMBRE', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'CARGO', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'PROCESO', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
  ]);

  const teamList = data.work_team && data.work_team.length > 0 ? data.work_team : [{ nombre: '', cargo: '', proceso: '' }];
  for (const member of teamList) {
    bodyRows.push([
      { content: member.nombre || '', styles: { halign: 'center', fontSize: 8 } },
      { content: member.cargo || '', styles: { halign: 'center', fontSize: 8 } },
      { content: member.proceso || '', colSpan: 2, styles: { halign: 'center', fontSize: 8 } },
    ]);
  }

  // 3. SECCIÓN 3: ANÁLISIS DEL CAMBIO (Fila dorada #FFC000)
  bodyRows.push([
    {
      content: '3. ANÁLISIS DEL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [255, 192, 0], fontStyle: 'bold', fontSize: 9, halign: 'left', minCellHeight: 6.5 },
    },
  ]);

  bodyRows.push([
    {
      content: 'RIESGOS ASOCIADOS AL CAMBIO (INCLUYE RIESGOS PARA LA SST)',
      colSpan: 4,
      styles: { fillColor: [216, 216, 216], fontStyle: 'bold', fontSize: 8.5, halign: 'left', minCellHeight: 6 },
    },
  ]);

  bodyRows.push([
    { content: 'Descripción de los efectos potenciales', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Tipo', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Controles / acciones a tomar', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
  ]);

  const risksList = data.risks && data.risks.length > 0 ? data.risks : [{ descripcion_efectos: '', tipo: 'Amenaza' as const, controles_acciones: '' }];
  for (const rk of risksList) {
    bodyRows.push([
      { content: rk.descripcion_efectos || '', styles: { halign: 'left', fontSize: 8 } },
      { content: rk.tipo || 'Amenaza', styles: { halign: 'center', fontSize: 8 } },
      { content: rk.controles_acciones || '', colSpan: 2, styles: { halign: 'left', fontSize: 8 } },
    ]);
  }

  // 4. SECCIÓN 4: IMPLEMENTACIÓN DEL CAMBIO (Fila dorada #FFC000)
  bodyRows.push([
    {
      content: '4. IMPLEMENTACIÓN DEL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [255, 192, 0], fontStyle: 'bold', fontSize: 9, halign: 'left', minCellHeight: 6.5 },
    },
  ]);

  bodyRows.push([
    { content: 'Actividades', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Responsable', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Fecha límite', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Producto esperado', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
  ]);

  const actList = data.activities && data.activities.length > 0 ? data.activities : [{ actividad: '', responsable: '', fecha_limite: '', producto_esperado: '' }];
  for (const act of actList) {
    bodyRows.push([
      { content: act.actividad || '', styles: { halign: 'left', fontSize: 8 } },
      { content: act.responsable || '', styles: { halign: 'center', fontSize: 8 } },
      { content: act.fecha_limite || '', styles: { halign: 'center', font: 'courier', fontSize: 8 } },
      { content: act.producto_esperado || '', styles: { halign: 'left', fontSize: 8 } },
    ]);
  }

  // 5. SECCIÓN 5: APROBACIÓN DEL CAMBIO (Fila dorada #FFC000)
  bodyRows.push([
    {
      content: '4. APROBACIÓN DEL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [255, 192, 0], fontStyle: 'bold', fontSize: 9, halign: 'left', minCellHeight: 6.5 },
    },
  ]);

  bodyRows.push([
    { content: 'Nombre de quien aprueba el cambio', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Cargo', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Proceso', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Firma', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
  ]);

  approvalSignRowIdx = bodyRows.length;
  bodyRows.push([
    { content: data.approval_name || '', styles: { halign: 'center', fontSize: 8, minCellHeight: 18, valign: 'middle' } },
    { content: data.approval_position || '', styles: { halign: 'center', fontSize: 8, minCellHeight: 18, valign: 'middle' } },
    { content: data.approval_process || '', styles: { halign: 'center', fontSize: 8, minCellHeight: 18, valign: 'middle' } },
    { content: data.approval_signature?.startsWith('data:image') ? '' : (data.approval_signature || (data.approval_name ? 'Aprobado digitalmente' : '')), styles: { halign: 'center', fontSize: 7.5, minCellHeight: 18, valign: 'middle' } },
  ]);

  bodyRows.push([
    { content: 'Nombre del responsable del seguimiento del cambio', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Cargo', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Proceso', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
    { content: 'Firma', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
  ]);

  trackingSignRowIdx = bodyRows.length;
  bodyRows.push([
    { content: data.tracking_name || '', styles: { halign: 'center', fontSize: 8, minCellHeight: 18, valign: 'middle' } },
    { content: data.tracking_position || '', styles: { halign: 'center', fontSize: 8, minCellHeight: 18, valign: 'middle' } },
    { content: data.tracking_process || '', styles: { halign: 'center', fontSize: 8, minCellHeight: 18, valign: 'middle' } },
    { content: data.tracking_signature?.startsWith('data:image') ? '' : (data.tracking_signature || (data.tracking_name ? 'En seguimiento' : '')), styles: { halign: 'center', fontSize: 7.5, minCellHeight: 18, valign: 'middle' } },
  ]);

  // 6. SECCIÓN 6: EFECTIVIDAD DEL CAMBIO (Fila dorada #FFC000)
  bodyRows.push([
    {
      content: '5. EFECTIVIDAD DEL CAMBIO',
      colSpan: 4,
      styles: { fillColor: [255, 192, 0], fontStyle: 'bold', fontSize: 9, halign: 'left', minCellHeight: 6.5 },
    },
  ]);

  const ctrlSi = data.control_risks_controlled === true;
  const ctrlNo = data.control_risks_controlled === false;
  bodyRows.push([
    { content: 'Se controlaron los riesgos generados por el cambio', styles: { fontSize: 8, fontStyle: 'bold' } },
    { content: `SI ${box(ctrlSi)}`, styles: { halign: 'center', font: 'courier', fontStyle: 'bold' } },
    { content: `NO ${box(ctrlNo)}`, styles: { halign: 'center', font: 'courier', fontStyle: 'bold' } },
    { content: '', styles: {} },
  ]);

  const effSi = data.change_effective === true;
  const effNo = data.change_effective === false;
  bodyRows.push([
    { content: 'Efectividad del Cambio', styles: { fontSize: 8, fontStyle: 'bold' } },
    { content: `SI ${box(effSi)}`, styles: { halign: 'center', font: 'courier', fontStyle: 'bold' } },
    { content: `NO ${box(effNo)}`, styles: { halign: 'center', font: 'courier', fontStyle: 'bold' } },
    { content: '', styles: {} },
  ]);

  bodyRows.push([
    {
      content: 'Si la respuesta es no, se debe plantear acciones de mejora de acuerdo al procedimiento de Acciones Correctivas y de Mejora',
      colSpan: 4,
      styles: { fontSize: 7.5, fontStyle: 'italic', textColor: [60, 60, 60] },
    },
  ]);

  bodyRows.push([
    {
      content: data.effectiveness_notes_no || 'Ninguna observación adicional registrada.',
      colSpan: 4,
      styles: { fontSize: 8, halign: 'left', minCellHeight: 12 },
    },
  ]);

  // Renderizado de autoTable con bordes negros finos y réplica idéntica de Excel
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 12 },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: colWidths[0] },
      1: { cellWidth: colWidths[1] },
      2: { cellWidth: colWidths[2] },
      3: { cellWidth: colWidths[3] },
    },
    body: bodyRows,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawCell: (cellData: any) => {
      // Estampar imagen de firma de aprobación si existe base64
      if (cellData.row.index === approvalSignRowIdx && cellData.column.index === 3) {
        if (data.approval_signature?.startsWith('data:image')) {
          try {
            const padX = cellData.cell.x + 3;
            const padY = cellData.cell.y + 1.5;
            const w = Math.max(cellData.cell.width - 6, 10);
            const h = Math.max(cellData.cell.height - 3, 10);
            doc.addImage(data.approval_signature, 'PNG', padX, padY, w, h);
          } catch (e) {
            console.warn('Error dibujando firma de aprobación en PDF:', e);
          }
        }
      }

      // Estampar imagen de firma de seguimiento si existe base64
      if (cellData.row.index === trackingSignRowIdx && cellData.column.index === 3) {
        if (data.tracking_signature?.startsWith('data:image')) {
          try {
            const padX = cellData.cell.x + 3;
            const padY = cellData.cell.y + 1.5;
            const w = Math.max(cellData.cell.width - 6, 10);
            const h = Math.max(cellData.cell.height - 3, 10);
            doc.addImage(data.tracking_signature, 'PNG', padX, padY, w, h);
          } catch (e) {
            console.warn('Error dibujando firma de seguimiento en PDF:', e);
          }
        }
      }
    },
  });

  // Pie de página institucional discreto
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('PROCIMEC  •  PCM CLOUD  •  Sistema Integrado de Gestión (SIG)  •  Formato Oficial FOR-SIG-001', margin, 204);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 204, { align: 'right' });
  }

  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}
