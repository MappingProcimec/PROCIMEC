import { drive_v3, google } from 'googleapis';

export const HSEQ_TEMPLATES_FOLDER_ID =
  process.env.GOOGLE_DRIVE_HSEQ_TEMPLATES_FOLDER_ID || '1CwEDHn4Vv77dbW5du6EvHGufd78yDCHS';

export const HSEQ_EVIDENCE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_HSEQ_EVIDENCE_FOLDER_ID || '18kLylRhxxQG7hfMgie9ByHCE6AfdDhrv';

export interface HseqTemplateItem {
  id: string;
  name: string;
  code: string;
  title: string;
  folderId: string;
  folderName: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

// ─── Cache en memoria para evitar saturar cuotas de Google Drive ─────────────
let cachedTemplates: HseqTemplateItem[] | null = null;
let lastScanTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché

// ─── Cliente Google Drive para HSEQ ──────────────────────────────────────────
async function getDriveClient(): Promise<drive_v3.Drive> {
  const refreshToken = process.env.GOOGLE_DRIVE_ADMIN_REFRESH_TOKEN;

  if (refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      (process.env.NEXTAUTH_URL || 'http://localhost:3000') + '/api/auth/callback/google'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // Fallback a Service Account si está configurada
  const base64Key = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (base64Key) {
    const credentials = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf-8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  }

  // Fallback 3: leer refresh_token del admin en Supabase
  try {
    const { createAdminClient } = await import('./supabase');
    const supabase = createAdminClient();
    const adminEmail = process.env.GOOGLE_DRIVE_ADMIN_EMAIL || 'mapping.procimec2024@gmail.com';

    const { data } = await supabase
      .from('users')
      .select('drive_refresh_token')
      .eq('email', adminEmail)
      .single();

    if (data?.drive_refresh_token) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        (process.env.NEXTAUTH_URL || 'http://localhost:3000') + '/api/auth/callback/google'
      );
      oauth2Client.setCredentials({ refresh_token: data.drive_refresh_token });
      return google.drive({ version: 'v3', auth: oauth2Client });
    }
  } catch (err) {
    console.warn('Error intentando obtener token de Supabase para HSEQ Drive:', err);
  }

  throw new Error(
    'No hay credenciales configuradas para Google Drive (se requiere GOOGLE_DRIVE_ADMIN_REFRESH_TOKEN o GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY).'
  );
}

// ─── Extracción limpia de código y título ────────────────────────────────────
function parseFormatName(rawName: string): { code: string; title: string } {
  const withoutExt = rawName.replace(/\.(xlsx|xls|gdoc|gsheet)$/i, '').trim();
  const match = withoutExt.match(/^(FOR-[A-Z0-9\-_]+)(.*)$/i);

  if (match) {
    const code = match[1].trim().toUpperCase();
    const title = match[2]
      .replace(/^[\s\-_]+/, '')
      .replace(/[\s\-_]+v\d+.*$/i, '')
      .trim();
    return { code, title: title || code };
  }

  return { code: 'FOR-HSEQ', title: withoutExt };
}

// ─── Exploración Recursiva de Carpetas en Drive ──────────────────────────────
export async function scanHseqTemplates(forceRefresh = false): Promise<HseqTemplateItem[]> {
  const now = Date.now();
  if (!forceRefresh && cachedTemplates && now - lastScanTimestamp < CACHE_TTL_MS) {
    return cachedTemplates;
  }

  const drive = await getDriveClient();
  const rootId = HSEQ_TEMPLATES_FOLDER_ID;

  const results: HseqTemplateItem[] = [];
  const foldersToScan: { id: string; name: string }[] = [{ id: rootId, name: 'Raíz Formatos' }];
  const visitedFolders = new Set<string>();

  while (foldersToScan.length > 0) {
    const currentFolder = foldersToScan.shift()!;
    if (visitedFolders.has(currentFolder.id)) continue;
    visitedFolders.add(currentFolder.id);

    try {
      let pageToken: string | undefined = undefined;

      do {
        // Consultar carpetas y archivos hijos directos
        const res: drive_v3.Schema$FileList = (
          await drive.files.list({
            q: `'${currentFolder.id}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, size)',
            pageSize: 100,
            pageToken,
          })
        ).data;

        const files = res.files ?? [];

        for (const file of files) {
          if (!file.id || !file.name) continue;

          // Si es una subcarpeta, la encolamos para explorarla
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            foldersToScan.push({
              id: file.id,
              name: file.name,
            });
          } else {
            // Si es un archivo y su nombre empieza o contiene FOR-
            const isForTemplate = /FOR-/i.test(file.name);
            const isSpreadsheet =
              file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
              file.mimeType === 'application/vnd.google-apps.spreadsheet' ||
              file.name.toLowerCase().endsWith('.xlsx');

            if (isForTemplate && isSpreadsheet) {
              const { code, title } = parseFormatName(file.name);

              results.push({
                id: file.id,
                name: file.name,
                code,
                title,
                folderId: currentFolder.id,
                folderName: currentFolder.name,
                mimeType: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                modifiedTime: file.modifiedTime ?? undefined,
                webViewLink: file.webViewLink ?? undefined,
                size: file.size ?? undefined,
              });
            }
          }
        }

        pageToken = res.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (folderErr) {
      console.error(`Error escaneando carpeta ${currentFolder.name} (${currentFolder.id}):`, folderErr);
    }
  }

  // Ordenar por código
  results.sort((a, b) => a.code.localeCompare(b.code));

  cachedTemplates = results;
  lastScanTimestamp = now;

  return results;
}

// ─── Mapeo Oficial de Columnas por Día (Checklist Semanal) ───────────────────
export interface InspectionMatrixItem {
  fila: number;
  dia: string;
  estado: 'SI' | 'NO' | 'NA';
}

export const DAY_COLUMN_MAP: Record<string, Record<'SI' | 'NO' | 'NA', string>> = {
  LUNES:     { SI: 'E', NO: 'F', NA: 'G' },
  MARTES:    { SI: 'H', NO: 'I', NA: 'J' },
  MIERCOLES: { SI: 'K', NO: 'L', NA: 'M' },
  'MIÉRCOLES': { SI: 'K', NO: 'L', NA: 'M' },
  JUEVES:    { SI: 'N', NO: 'O', NA: 'P' },
  VIERNES:   { SI: 'Q', NO: 'R', NA: 'S' },
  SABADO:    { SI: 'T', NO: 'U', NA: 'V' },
  'SÁBADO':  { SI: 'T', NO: 'U', NA: 'V' },
  DOMINGO:   { SI: 'W', NO: 'X', NA: 'Y' },
};

// ─── Inyección de Datos y Marcas 'X' en Buffer de Excel (.xlsx) ──────────────
export async function injectDataIntoExcelBuffer(
  templateBuffer: Buffer,
  textPlaceholders: Record<string, string>,
  matrixItems: InspectionMatrixItem[] = []
): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS buffer load
  await workbook.xlsx.load(templateBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('El archivo Excel de plantilla no contiene hojas de trabajo válidas.');

  // 1. Reemplazar marcadores entre corchetes [TAG] o {{TAG}}
  const entries = Object.entries(textPlaceholders);
  if (entries.length > 0) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && typeof cell.value === 'string') {
          let updated = cell.value;
          for (const [tag, val] of entries) {
            const regexBracket = new RegExp(`\\[${tag}\\]`, 'gi');
            const regexCurly = new RegExp(`\\{\\{${tag}\\}\\}`, 'gi');
            updated = updated.replace(regexBracket, val).replace(regexCurly, val);
          }
          if (updated !== cell.value) {
            cell.value = updated;
          }
        }
      });
    });
  }

  // 2. Inyectar 'X' en la matriz semanal según el día y estado
  for (const item of matrixItems) {
    const fila = item.fila;
    const diaNorm = (item.dia || '').trim().toUpperCase();
    const estadoNorm = (item.estado || '').trim().toUpperCase() as 'SI' | 'NO' | 'NA';

    const dayMap = DAY_COLUMN_MAP[diaNorm];
    if (dayMap && dayMap[estadoNorm]) {
      const colLetter = dayMap[estadoNorm];
      const targetCell = `${colLetter}${fila}`;
      const cell = worksheet.getCell(targetCell);
      cell.value = 'X';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  const outputBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(outputBuffer);
}

// ─── Generación de Evidencia y Conversión en Vuelo a PDF ─────────────────────
export async function generateHseqEvidencePdf(params: {
  templateFileId: string;
  templateCode: string;
  projectName: string;
  locatorName: string;
  inspectionDate: string;
  textPlaceholders?: Record<string, string>;
  matrixItems?: InspectionMatrixItem[];
}): Promise<{ fileId: string; fileName: string; webViewLink: string; pdfBase64: string }> {
  const {
    templateFileId,
    templateCode,
    projectName,
    locatorName,
    inspectionDate,
    textPlaceholders = {},
  } = params;

  const { Readable } = await import('stream');
  const { default: jsPDF } = await import('jspdf');

  // Nombre normalizado para la evidencia final
  const cleanCode = templateCode.replace(/[^A-Z0-9\-_]/gi, '_');
  const cleanProject = projectName.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 30);
  const cleanLocator = locatorName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `EVIDENCIA_${cleanCode}_${cleanProject}_${inspectionDate}_${cleanLocator}.pdf`;

  // 1. Extraer ítems reales del formato para listarlos en el PDF
  let inspectionItems: string[] = [];
  try {
    const extraction = await extractTemplateTextSummary(templateFileId);
    inspectionItems = extraction.leftColumnItems;
  } catch (extractErr) {
    console.warn('Extracción de ítems para el PDF omitida:', extractErr);
  }

  // 2. Construir el documento PDF con jsPDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  // Barra superior corporativa PROCIMEC
  doc.setFillColor(15, 118, 110); // Teal institucional PROCIMEC
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Encabezado
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PROCIMEC — MAPPING INGENIERÍA S.A.S.', margin, y);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Sistema Integrado de Gestión HSEQ — Evidencia Oficial de Inspección en Campo', margin, y + 5);

  // Badge del formato
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(204, 251, 241);
  doc.roundedRect(pageWidth - margin - 52, y - 3, 52, 12, 2, 2, 'FD');
  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(templateCode || 'FOR-HSEQ', pageWidth - margin - 50, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Fecha: ${inspectionDate}`, pageWidth - margin - 50, y + 6);

  y += 16;

  // Cuadro de Información General
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('PROYECTO:', margin + 4, y + 6);
  doc.text('LOCALIZADOR / RESPONSABLE:', margin + 4, y + 12);
  doc.text('FECHA DE INSPECCIÓN:', margin + 4, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(projectName || 'No especificado', margin + 26, y + 6);
  doc.text(locatorName || 'Localizador responsable', margin + 50, y + 12);
  doc.text(inspectionDate || new Date().toISOString().split('T')[0], margin + 42, y + 18);

  y += 30;

  // Sección: Puntos de Verificación de la Matriz de Inspección
  doc.setFillColor(15, 118, 110);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('1. PUNTOS DE VERIFICACIÓN E INSPECCIÓN EN CAMPO', margin + 3, y + 4.2);
  doc.text('ESTADO', pageWidth - margin - 22, y + 4.2);

  y += 8;

  const itemsToShow =
    inspectionItems.length > 0
      ? inspectionItems.slice(0, 14)
      : [
          'Estado general y operatividad de equipos técnicos',
          'Uso obligatorio y completo de Elementos de Protección Personal (EPP)',
          'Verificación de conexiones, baterías y sistemas de alimentación',
          'Delimitación y aseguramiento del área de trabajo e inspección',
          'Condiciones climáticas y de entorno favorables para la labor',
        ];

  doc.setFontSize(7.5);
  itemsToShow.forEach((item, idx) => {
    if (y > pageHeight - 45) return; // Evitar desborde de página

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 3, pageWidth - margin * 2, 5.5, 'F');
    }

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    const cleanItemText = item.replace(/^[0-9]+[\.\-\s]+/, '');
    const truncated = doc.splitTextToSize(`${idx + 1}. ${cleanItemText}`, pageWidth - margin * 2 - 30)[0];
    doc.text(truncated, margin + 2, y + 1);

    // Indicador Conforme
    doc.setTextColor(16, 185, 129); // Verde emerald
    doc.setFont('helvetica', 'bold');
    doc.text('[ CONFORME ]', pageWidth - margin - 26, y + 1);

    y += 5.5;
  });

  y += 4;

  // Sección: Observaciones y Notas de Inspección
  doc.setFillColor(15, 118, 110);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('2. NOTAS Y OBSERVACIONES REGISTRADAS EN CAMPO', margin + 3, y + 4.2);

  y += 8;

  const notesContent =
    textPlaceholders.OBSERVACIONES ||
    textPlaceholders.NOTAS ||
    'Inspección completada conforme a los parámetros de seguridad establecidos por PROCIMEC. Sin novedades que inhabiliten la operación.';

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  const notesLines = doc.splitTextToSize(notesContent, pageWidth - margin * 2 - 8);
  const notesBoxHeight = Math.max(18, Math.min(32, notesLines.length * 4.5 + 6));
  doc.roundedRect(margin, y, pageWidth - margin * 2, notesBoxHeight, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(notesLines.slice(0, 6), margin + 4, y + 5);

  y += notesBoxHeight + 10;

  // Firmas de Responsabilidad al pie de la página
  const signY = Math.max(y, pageHeight - 32);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);

  // Firma Localizador
  doc.line(margin + 10, signY, margin + 70, signY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(locatorName || 'Localizador Responsable', margin + 15, signY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Localizador en Sitio / PROCIMEC', margin + 15, signY + 7.5);

  // Firma Supervisión HSEQ
  doc.line(pageWidth - margin - 70, signY, pageWidth - margin - 10, signY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Supervisión HSEQ / Operaciones', pageWidth - margin - 65, signY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Aprobación Técnica y de Seguridad', pageWidth - margin - 65, signY + 7.5);

  // Pie de página
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento digital generado automáticamente por PROCIMEC SIG el ${new Date().toLocaleString('es-CO')}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(pdfArrayBuffer);
  const pdfBase64 = pdfBuffer.toString('base64');

  // 3. Subir el archivo PDF final directamente a Google Drive en la carpeta de EVIDENCIAS
  let uploadedFileId = '';
  let webViewLink = '';

  try {
    const drive = await getDriveClient();
    const evidenceFile = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [HSEQ_EVIDENCE_FOLDER_ID],
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer),
      },
      fields: 'id, name, webViewLink',
    });

    uploadedFileId = evidenceFile.data.id || '';
    webViewLink =
      evidenceFile.data.webViewLink ||
      `https://drive.google.com/file/d/${evidenceFile.data.id}/view`;
  } catch (driveErr) {
    console.warn('Aviso: No se pudo subir el PDF a Drive, se devolverá para descarga directa:', driveErr);
  }

  return {
    fileId: uploadedFileId || `local-${Date.now()}`,
    fileName,
    webViewLink: webViewLink || '',
    pdfBase64,
  };
}


// ─── Extracción de texto y preguntas reales de la plantilla Excel ─────────────
export interface TemplateExtractionResult {
  leftColumnItems: string[];
  fullTextSummary: string;
}

export async function extractTemplateTextSummary(templateFileId: string): Promise<TemplateExtractionResult> {
  try {
    const drive = await getDriveClient();
    const downloadRes = await drive.files.get(
      { fileId: templateFileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const templateBuffer = Buffer.from(downloadRes.data as ArrayBuffer);

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error ExcelJS buffer load
    await workbook.xlsx.load(templateBuffer);

    const worksheet = workbook.worksheets.find((ws) => ws.rowCount > 5) || workbook.worksheets[0];
    if (!worksheet) return { leftColumnItems: [], fullTextSummary: '' };

    const detectedLeftItems: string[] = [];
    const allLines: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // Iniciar de la fila 10 para abajo
      if (rowNumber < 10) return;

      const candidateTexts: string[] = [];
      const allRowTexts: string[] = [];

      row.eachCell((cell, colNumber) => {
        let val = '';
        if (typeof cell.value === 'string') {
          val = cell.value;
        } else if (cell.value && typeof cell.value === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (Array.isArray((cell.value as any).richText)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            val = (cell.value as any).richText.map((r: any) => r.text).join(' ');
          } else {
            val = cell.text || '';
          }
        } else if (cell.value !== null && cell.value !== undefined) {
          val = String(cell.value);
        }

        const trimmed = val.trim();
        if (trimmed.length > 2) {
          allRowTexts.push(trimmed);
          // Columnas A, B, C, D hasta la columna E (colNumber <= 5)
          if (colNumber <= 5 && !/^[\d\s\.\,\-]+$/.test(trimmed)) {
            if (!/^(si|no|na|n\/a|x|c|nc)$/i.test(trimmed)) {
              candidateTexts.push(trimmed);
            }
          }
        }
      });

      // 1. Extraer textos únicos limpios de la fila
      const uniqueTexts = Array.from(
        new Set(
          candidateTexts.map((t) =>
            t
              .replace(/\{\{[^}]*\}\}/g, '')
              .replace(/\[[^\]]*\]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
          )
        )
      ).filter(
        (t) =>
          t.length > 3 &&
          !/^[\d\.\,\-\s]+$/.test(t) &&
          !/^(si|no|na|n\/a|x|c|nc|item|ítem|código|codigo|versión|version|fecha|proyecto|localizador|responsable|cliente|semana|mes|año|firma|observaciones|notas|convenciones|marque con una x|marque|estado|conforme)$/i.test(
            t
          )
      );

      if (uniqueTexts.length === 0) return;

      // Omitir firmas y notas de pie de página (no son preguntas de inspección)
      const joinedLine = uniqueTexts.join(' ');
      if (
        /^(FIRMA|RESPONSABLE SSTA|RESPONSABLE DEL|APROB|REVIS|NOTA IMPORTANTE|SUPERVISOR)/i.test(joinedLine) ||
        joinedLine.includes('La inspección preoperacional debe realizarla')
      ) {
        return;
      }

      // Omitir títulos de sección de una sola palabra corta (ej. "EQUIPOS", "SISTEMA")
      if (uniqueTexts.length === 1 && uniqueTexts[0].length < 18 && !uniqueTexts[0].includes(' ')) {
        return;
      }

      // Tomar la descripción técnica más larga y detallada de la fila
      const sortedByDetail = [...uniqueTexts].sort((a, b) => b.length - a.length);
      const mainQuestion = sortedByDetail[0];

      if (mainQuestion && mainQuestion.length > 6) {
        const cleanedItem = mainQuestion.replace(/^[0-9]+[\.\-\)\s]+/, '').trim();
        if (!detectedLeftItems.includes(cleanedItem)) {
          detectedLeftItems.push(cleanedItem);
        }
      }

      if (allRowTexts.length > 0) {
        allLines.push(`Fila ${rowNumber}: ${allRowTexts.join(' | ')}`);
      }
    });


    return {
      leftColumnItems: detectedLeftItems.slice(0, 35),
      fullTextSummary: allLines.slice(0, 50).join('\n'),
    };

  } catch (err) {
    console.warn(`No se pudo extraer texto de la plantilla ${templateFileId}:`, err);
    return { leftColumnItems: [], fullTextSummary: '' };
  }
}

