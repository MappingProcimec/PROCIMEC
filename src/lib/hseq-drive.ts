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

async function getDriveClient(): Promise<drive_v3.Drive> {
  // 1. Service Account (Cuenta de Servicio: no expira nunca y tiene acceso estable y directo)
  const base64Key = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (base64Key) {
    try {
      const credentials = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf-8'));
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      return google.drive({ version: 'v3', auth });
    } catch (err) {
      console.warn('Error iniciando cliente Drive con Service Account:', err);
    }
  }

  // 2. Token directo en variables de entorno (si está configurado)
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

  // 3. Fallback a Supabase
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
    'No hay credenciales configuradas para Google Drive.'
  );
}

// ─── Cliente Google Drive para Subida (prioriza OAuth para cuota de usuario) ─
async function getUploadDriveClient(): Promise<drive_v3.Drive> {
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
    console.warn('Aviso obteniendo token admin de Supabase para subida:', err);
  }

  // Fallback a Service Account
  return getDriveClient();
}

// ─── Extracción limpia de código y título ────────────────────────────────────
function parseFormatName(rawName: string): { code: string; title: string } {
  const withoutExt = rawName.replace(/\.(xlsx|xls|gdoc|gsheet)$/i, '').trim();
  // Formato tipo FOR-HSEQ-001 o FOR-001
  const codeMatch = withoutExt.match(/^(FOR-[A-Za-z0-9\-_]+)(.*)$/i);
  if (codeMatch && codeMatch[2]?.trim()) {
    const code = codeMatch[1].trim().toUpperCase();
    const title = codeMatch[2]
      .replace(/^[\s\-_]+/, '')
      .replace(/[\s\-_]+v\d+.*$/i, '')
      .trim();
    return { code, title: title || code };
  }

  // Formato tipo "FOR-Inspección pre-operacional Drone"
  const cleanTitle = withoutExt.replace(/^FOR-[\s\-_]*/i, '').trim();
  const words = cleanTitle.split(/[\s\-_]+/);
  const codeWords = words.slice(0, 2).map((w) => w.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const code = codeWords.length > 0 ? `FOR-${codeWords.join('-')}` : 'FOR-HSEQ';

  return { code, title: cleanTitle };
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

  const fechaVal = textPlaceholders.FECHA || textPlaceholders.fecha || '';
  const proyectoVal = textPlaceholders.PROYECTO || textPlaceholders.proyecto || '';
  const respVal = textPlaceholders.LOCALIZADOR || textPlaceholders.RESPONSABLE || textPlaceholders.responsable || '';
  const obsVal = textPlaceholders.OBSERVACIONES || textPlaceholders.NOTAS || textPlaceholders.observaciones || '';

  // 1. Reemplazo directo de marcadores entre corchetes [TAG] o {{TAG}}
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

  // 2. Si las celdas tienen títulos estándar sin corchetes (ej. "FECHA:", "PROYECTO:"), escribir en celda contigua
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const cellText = (cell.text || '').trim().toUpperCase();

      if (fechaVal && (cellText === 'FECHA:' || cellText === 'FECHA' || cellText.startsWith('FECHA DE'))) {
        const nextCell = row.getCell(colNumber + 1);
        if (!nextCell.value || String(nextCell.value).trim() === '') {
          nextCell.value = fechaVal;
        }
      }

      if (proyectoVal && (cellText === 'PROYECTO:' || cellText === 'PROYECTO' || cellText.startsWith('NOMBRE DEL PROYECTO'))) {
        const nextCell = row.getCell(colNumber + 1);
        if (!nextCell.value || String(nextCell.value).trim() === '') {
          nextCell.value = proyectoVal;
        }
      }

      if (respVal && (cellText === 'RESPONSABLE:' || cellText === 'RESPONSABLE' || cellText === 'OPERADOR:' || cellText === 'LOCALIZADOR:')) {
        const nextCell = row.getCell(colNumber + 1);
        if (!nextCell.value || String(nextCell.value).trim() === '') {
          nextCell.value = respVal;
        }
      }

      if (obsVal && (cellText === 'OBSERVACIONES:' || cellText === 'OBSERVACIONES' || cellText === 'NOTAS:')) {
        const nextCell = row.getCell(colNumber + 1);
        if (!nextCell.value || String(nextCell.value).trim() === '') {
          nextCell.value = obsVal;
        } else {
          const rowBelow = worksheet.getRow(rowNumber + 1);
          const cellBelow = rowBelow.getCell(colNumber);
          if (!cellBelow.value || String(cellBelow.value).trim() === '') {
            cellBelow.value = obsVal;
          }
        }
      }
    });
  });

  // 3. Inyectar 'X' en la matriz semanal según el día y estado
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
}): Promise<{
  fileId: string;
  fileName: string;
  excelFileName: string;
  webViewLink: string;
  pdfBase64: string;
  excelBase64: string;
  driveError?: string | null;
}> {
  const {
    templateFileId,
    templateCode,
    projectName,
    locatorName,
    inspectionDate,
    textPlaceholders = {},
    matrixItems = [],
  } = params;

  const { Readable } = await import('stream');
  const drive = await getDriveClient();

  // Nombre normalizado para la evidencia final
  const cleanCode = templateCode.replace(/[^A-Z0-9\-_]/gi, '_');
  const cleanProject = projectName.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 30);
  const cleanLocator = locatorName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const titleBase = `EVIDENCIA_${cleanCode}_${cleanProject}_${inspectionDate}_${cleanLocator}`;
  const pdfFileName = `${titleBase}.pdf`;
  const excelFileName = `${titleBase}.xlsx`;

  // 1. Descargar la plantilla oficial Excel de Google Drive
  const downloadRes = await drive.files.get(
    { fileId: templateFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  const originalTemplateBuffer = Buffer.from(downloadRes.data as ArrayBuffer);

  // 2. Inyectar los datos reales, observaciones y marcas 'X' en la plantilla oficial
  const filledExcelBuffer = await injectDataIntoExcelBuffer(
    originalTemplateBuffer,
    textPlaceholders,
    matrixItems
  );

  let uploadedFileId = '';
  let webViewLink = '';
  let driveError: string | null = null;
  let officialPdfBuffer: Buffer | null = null;

  // 3. Subir a Google Drive en la carpeta de EVIDENCIAS
  try {
    const uploadDrive = await getUploadDriveClient();

    // 3a. Subir como Google Spreadsheet (convierte el .xlsx manteniendo formato oficial exacto)
    const evidenceSheet = await uploadDrive.files.create({
      requestBody: {
        name: titleBase,
        parents: [HSEQ_EVIDENCE_FOLDER_ID],
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Readable.from(filledExcelBuffer),
      },
      fields: 'id, name, webViewLink',
    });

    uploadedFileId = evidenceSheet.data.id || '';
    webViewLink =
      evidenceSheet.data.webViewLink ||
      (uploadedFileId ? `https://drive.google.com/file/d/${uploadedFileId}/view` : '');

    if (uploadedFileId) {
      // Dar permisos de lectura pública/empresa
      try {
        await uploadDrive.permissions.create({
          fileId: uploadedFileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
      } catch (permErr) {
        console.warn('Aviso dando permisos en Drive:', permErr);
      }

      // 3b. Exportar como PDF nativo de Google Drive (renderizado idéntico a la plantilla)
      try {
        const exportRes = await uploadDrive.files.export(
          {
            fileId: uploadedFileId,
            mimeType: 'application/pdf',
          },
          { responseType: 'arraybuffer' }
        );
        officialPdfBuffer = Buffer.from(exportRes.data as ArrayBuffer);
      } catch (exportErr) {
        console.warn('Exportación de Google Drive a PDF falló, usando generador de respaldo:', exportErr);
      }

      // 3c. También guardar el archivo .xlsx directo en la carpeta de EVIDENCIAS
      try {
        await uploadDrive.files.create({
          requestBody: {
            name: excelFileName,
            parents: [HSEQ_EVIDENCE_FOLDER_ID],
          },
          media: {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: Readable.from(filledExcelBuffer),
          },
          fields: 'id',
        });
      } catch (xlsxErr) {
        console.warn('Aviso guardando archivo .xlsx en Drive:', xlsxErr);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('storage quota') || message.includes('invalid_grant')) {
      driveError = 'El token de Google Drive ha expirado. Por favor, cierra sesión y vuelve a iniciar sesión con Google (mapping.procimec2024@gmail.com) para autorizar la subida automática a Drive.';
    } else {
      driveError = message;
    }
    console.error('Error subiendo evidencia a Google Drive:', err);
  }

  // 4. Si Google Drive export no produjo PDF, generar PDF de contingencia
  let pdfBase64 = '';
  if (officialPdfBuffer) {
    pdfBase64 = officialPdfBuffer.toString('base64');
  } else {
    // Generador de respaldo con jsPDF
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;

    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROCIMEC — MAPPING INGENIERÍA S.A.S.', margin, y);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Sistema de Gestión HSEQ — Evidencia Oficial de Inspección en Campo', margin, y + 5);

    y += 16;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMATO:', margin + 4, y + 6);
    doc.text('PROYECTO:', margin + 4, y + 12);
    doc.text('RESPONSABLE:', margin + 4, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(templateCode, margin + 26, y + 6);
    doc.text(projectName, margin + 26, y + 12);
    doc.text(`${locatorName} (Fecha: ${inspectionDate})`, margin + 28, y + 18);

    y += 30;
    doc.setFillColor(15, 118, 110);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('NOTAS Y OBSERVACIONES DE INSPECCIÓN', margin + 3, y + 4.2);

    y += 8;
    const notesContent = textPlaceholders.OBSERVACIONES || textPlaceholders.NOTAS || 'Inspección completada conforme.';
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitNotes = doc.splitTextToSize(notesContent, pageWidth - margin * 2 - 8);
    doc.text(splitNotes, margin + 4, y + 4);

    const pdfArrayBuffer = doc.output('arraybuffer');
    pdfBase64 = Buffer.from(pdfArrayBuffer).toString('base64');
  }

  return {
    fileId: uploadedFileId || `local-${Date.now()}`,
    fileName: pdfFileName,
    excelFileName,
    webViewLink: webViewLink || '',
    pdfBase64,
    excelBase64: filledExcelBuffer.toString('base64'),
    driveError,
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

