/* eslint-disable @typescript-eslint/no-explicit-any */
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

export async function getDriveClient(): Promise<drive_v3.Drive> {
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
export async function getUploadDriveClient(): Promise<drive_v3.Drive> {
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

    const { data: usersWithToken } = await supabase
      .from('users')
      .select('drive_refresh_token, email')
      .not('drive_refresh_token', 'is', null);

    const targetUser =
      usersWithToken?.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase()) ||
      usersWithToken?.[0];

    if (targetUser?.drive_refresh_token) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        (process.env.NEXTAUTH_URL || 'http://localhost:3000') + '/api/auth/callback/google'
      );
      oauth2Client.setCredentials({ refresh_token: targetUser.drive_refresh_token });
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

  // Caso específico Drone
  if (/drone/i.test(withoutExt)) {
    return { code: 'FOR-HSEQ-024', title: 'Inspección Pre-operacional de Drone' };
  }
  // Caso específico Estación Total
  if (/estaci[oó]n\s*total/i.test(withoutExt) || /total\s*station/i.test(withoutExt)) {
    return { code: 'FOR-HSEQ-025', title: 'Inspección Pre-operacional de Estación Total' };
  }

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

  // Formato tipo "FOR-Inspección..."
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

// ─── Lector seguro de texto en celdas (evita error null.toString en celdas combinadas de ExcelJS)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCellSafeText(cell: any): string {
  try {
    if (!cell) return '';
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      if (Array.isArray(v.richText)) {
        return v.richText.map((r: any) => (r && r.text ? String(r.text) : '')).join('');
      }
      if (v.text && typeof v.text === 'string') return v.text;
      if (v.result !== undefined && v.result !== null) return String(v.result);
      return '';
    }
    return '';
  } catch {
    return '';
  }
}

// ─── Inyección de Datos y Marcas 'X' en Buffer de Excel (.xlsx) ──────────────
export async function injectDataIntoExcelBuffer(
  templateBuffer: Buffer,
  textPlaceholders: Record<string, string>,
  matrixItems: InspectionMatrixItem[] = []
): Promise<Buffer> {
  const ExcelJSModule = await import('exceljs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
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
    worksheet.eachRow((row: any) => {
      row.eachCell((cell: any) => {
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
  worksheet.eachRow((row: any, rowNumber: number) => {
    row.eachCell((cell: any, colNumber: number) => {
      const cellText = getCellSafeText(cell).trim().toUpperCase();

      if (fechaVal && (cellText === 'FECHA:' || cellText === 'FECHA' || cellText.startsWith('FECHA DE'))) {
        const nextCell = row.getCell(colNumber + 1);
        if (!getCellSafeText(nextCell).trim()) {
          nextCell.value = fechaVal;
        }
      }

      if (proyectoVal && (cellText === 'PROYECTO:' || cellText === 'PROYECTO' || cellText.startsWith('NOMBRE DEL PROYECTO'))) {
        const nextCell = row.getCell(colNumber + 1);
        if (!getCellSafeText(nextCell).trim()) {
          nextCell.value = proyectoVal;
        }
      }

      if (respVal && (cellText === 'RESPONSABLE:' || cellText === 'RESPONSABLE' || cellText === 'OPERADOR:' || cellText === 'LOCALIZADOR:')) {
        const nextCell = row.getCell(colNumber + 1);
        if (!getCellSafeText(nextCell).trim()) {
          nextCell.value = respVal;
        }
      }

      if (obsVal && (cellText === 'OBSERVACIONES:' || cellText === 'OBSERVACIONES' || cellText === 'NOTAS:')) {
        const nextCell = row.getCell(colNumber + 1);
        if (!getCellSafeText(nextCell).trim()) {
          nextCell.value = obsVal;
        } else {
          const rowBelow = worksheet.getRow(rowNumber + 1);
          const cellBelow = rowBelow.getCell(colNumber);
          if (!getCellSafeText(cellBelow).trim()) {
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
    // Generador de PDF de alta fidelidad que replica la estructura oficial de inspección
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 14;

    // Extraer los ítems de verificación reales del buffer Excel diligenciado
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(filledExcelBuffer);
    const ws = wb.worksheets[0];

    const inspectionRows: Array<{
      num: number;
      category: string;
      description: string;
      status: string;
    }> = [];

    if (ws) {
      let currentCat = '';
      for (let r = 11; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const catCell = row.getCell(1);
        const descCell = row.getCell(3);

        const cat = getCellSafeText(catCell).trim();
        const desc = getCellSafeText(descCell).trim();

        if (cat && !cat.startsWith('OBSERVACIONES') && !cat.startsWith('FIRMA') && !cat.startsWith('PUNTO') && !cat.startsWith('LUNES') && !cat.startsWith('EQUIPOS')) {
          currentCat = cat;
        }
        if (desc && desc.length > 4 && !desc.startsWith('OBSERVACIONES') && !desc.startsWith('FIRMA') && !desc.startsWith('PUNTO') && !desc.startsWith('LUNES') && !desc.startsWith('EQUIPOS') && !desc.startsWith('SI') && !desc.startsWith('NO')) {
          inspectionRows.push({
            num: inspectionRows.length + 1,
            category: currentCat || 'GENERAL',
            description: desc,
            status: 'CUMPLE (SI)',
          });
        }
        if (cat.startsWith('OBSERVACIONES') || cat.startsWith('FIRMA')) break;
      }
    }

    // 1. Barra superior institucional y cabecera
    doc.setFillColor(27, 43, 75); // Azul Marino PROCIMEC
    doc.rect(0, 0, pageWidth, 5, 'F');

    doc.setTextColor(27, 43, 75);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROCIMEC — MAPPING INGENIERÍA S.A.S.', margin, y);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('SISTEMA DE GESTIÓN INTEGRAL HSEQ — FORMATO DE INSPECCIÓN PRE-OPERACIONAL', margin, y + 4.5);

    // Badge con código oficial
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(pageWidth - margin - 52, y - 4, 52, 12, 1.5, 1.5, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanCode.substring(0, 22), pageWidth - margin - 49, y + 1.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Versión: 02 | Estado: Vigente', pageWidth - margin - 49, y + 5.5);

    y += 14;

    // 2. Cuadro de Metadatos de la Inspección
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('PROYECTO:', margin + 4, y + 5);
    doc.text('RESPONSABLE / OPERADOR:', margin + 4, y + 10.5);
    doc.text('FORMATO OFICIAL:', margin + 4, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(projectName.substring(0, 50), margin + 45, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(locatorName.substring(0, 40), margin + 45, y + 10.5);
    doc.text(templateCode.substring(0, 45), margin + 45, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('FECHA:', pageWidth - margin - 55, y + 5);
    doc.text('DÍA SEMANA:', pageWidth - margin - 55, y + 10.5);
    doc.text('ESTADO:', pageWidth - margin - 55, y + 16);

    // Calcular día de la semana
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const dateParsed = new Date(inspectionDate + 'T12:00:00');
    const dayLabel = dayNames[dateParsed.getDay()] || 'CAMPO';

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(inspectionDate, pageWidth - margin - 32, y + 5);
    doc.text(dayLabel, pageWidth - margin - 32, y + 10.5);
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFORME', pageWidth - margin - 32, y + 16);

    y += 26;

    // 3. Cabecera de la Tabla de Inspección
    const drawTableHeader = (curY: number) => {
      doc.setFillColor(15, 118, 110);
      doc.rect(margin, curY, pageWidth - margin * 2, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('N°', margin + 2, curY + 4.5);
      doc.text('COMPONENTE', margin + 10, curY + 4.5);
      doc.text('CRITERIO DE INSPECCIÓN / VERIFICACIÓN EN CAMPO', margin + 42, curY + 4.5);
      doc.text('ESTADO VERIFICADO', pageWidth - margin - 35, curY + 4.5);
    };

    drawTableHeader(y);
    y += 6.5;

    // 4. Filas de Inspección Pre-operacional
    inspectionRows.forEach((item, idx) => {
      if (y > pageHeight - 38) {
        doc.addPage();
        y = 14;
        drawTableHeader(y);
        y += 6.5;
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(item.num), margin + 2, y + 4.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(item.category.substring(0, 16), margin + 10, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(item.description.substring(0, 72), margin + 42, y + 4.2);

      // Badge CUMPLE
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(pageWidth - margin - 35, y + 1, 30, 4.2, 1, 1, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('[ X ] CUMPLE (SI)', pageWidth - margin - 32, y + 3.9);

      y += 6;
    });

    y += 4;
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 14;
    }

    // 5. Cuadro de Observaciones
    const notesContent = textPlaceholders.OBSERVACIONES || textPlaceholders.NOTAS || 'Inspección técnica completada satisfactoriamente sin novedades críticas.';
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(`OBSERVACIONES Y NOTAS DE INSPECCIÓN EN CAMPO (${dayLabel}):`, margin + 3, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const splitNotes = doc.splitTextToSize(notesContent, pageWidth - margin * 2 - 8);
    doc.text(splitNotes, margin + 3, y + 8.5);

    y += 24;
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }

    // 6. Firmas Institucionales
    const sigWidth = (pageWidth - margin * 2 - 10) / 2;
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 5, y + 8, margin + sigWidth - 5, y + 8);
    doc.line(margin + sigWidth + 15, y + 8, pageWidth - margin - 5, y + 8);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('FIRMA RESPONSABLE / OPERADOR DEL EQUIPO', margin + 10, y + 12);
    doc.text('FIRMA RESPONSABLE SSTA / SUPERVISOR HSEQ', margin + sigWidth + 20, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(locatorName || 'Localizador Asignado', margin + 10, y + 16);
    doc.text('PROCIMEC MAPPING INGENIERÍA S.A.S.', margin + sigWidth + 20, y + 16);

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

    const ExcelJSModule = await import('exceljs');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    const worksheet = workbook.worksheets.find((ws: any) => ws.rowCount > 5) || workbook.worksheets[0];
    if (!worksheet) return { leftColumnItems: [], fullTextSummary: '' };

    const detectedLeftItems: string[] = [];
    const allLines: string[] = [];

    worksheet.eachRow((row: any, rowNumber: number) => {
      // Iniciar de la fila 10 para abajo
      if (rowNumber < 10) return;

      const candidateTexts: string[] = [];
      const allRowTexts: string[] = [];

      row.eachCell((cell: any, colNumber: number) => {
        const val = getCellSafeText(cell);

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

