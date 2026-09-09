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
}): Promise<{ fileId: string; fileName: string; webViewLink: string }> {
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
  const fileName = `EVIDENCIA_${cleanCode}_${cleanProject}_${inspectionDate}_${cleanLocator}.pdf`;

  // 1. Descargar plantilla .xlsx desde Google Drive
  const downloadRes = await drive.files.get(
    { fileId: templateFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  const templateBuffer = Buffer.from(downloadRes.data as ArrayBuffer);

  // 2. Inyectar los marcadores [TAG] y las 'X' de la matriz
  const enrichedPlaceholders: Record<string, string> = {
    FECHA: inspectionDate,
    PROYECTO: projectName,
    LOCALIZADOR: locatorName,
    RESPONSABLE: locatorName,
    ...textPlaceholders,
  };

  const modifiedExcelBuffer = await injectDataIntoExcelBuffer(
    templateBuffer,
    enrichedPlaceholders,
    matrixItems
  );

  // 3. Subir temporalmente como Google Spreadsheet para aprovechar la conversión nativa a PDF
  const tempSpreadsheet = await drive.files.create({
    requestBody: {
      name: `TEMP_HSEQ_CONVERT_${Date.now()}`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(modifiedExcelBuffer),
    },
    fields: 'id',
  });

  const tempId = tempSpreadsheet.data.id;
  if (!tempId) throw new Error('No se pudo crear la hoja temporal en Google Drive para conversión a PDF.');

  try {
    // 4. Exportar la hoja de cálculo como PDF de solo lectura
    const pdfExportRes = await drive.files.export(
      {
        fileId: tempId,
        mimeType: 'application/pdf',
      },
      { responseType: 'stream' }
    );

    // 5. Depositar el PDF final en la Carpeta General de EVIDENCIAS
    const evidenceFile = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [HSEQ_EVIDENCE_FOLDER_ID],
      },
      media: {
        mimeType: 'application/pdf',
        body: pdfExportRes.data,
      },
      fields: 'id, name, webViewLink',
    });

    return {
      fileId: evidenceFile.data.id || '',
      fileName: evidenceFile.data.name || fileName,
      webViewLink:
        evidenceFile.data.webViewLink ||
        `https://drive.google.com/file/d/${evidenceFile.data.id}/view`,
    };
  } finally {
    // 6. Limpieza garantizada: eliminar el archivo editable temporal de Drive
    try {
      await drive.files.delete({ fileId: tempId });
    } catch (cleanupErr) {
      console.warn('Limpieza de archivo temporal Drive omitida:', cleanupErr);
    }
  }
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

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { leftColumnItems: [], fullTextSummary: '' };

    const detectedLeftItems: string[] = [];
    const allLines: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const leftColTexts: string[] = [];
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
          // Las columnas de preguntas de inspección están en la izquierda (columnas 1 a 4, antes de los días que inician en E=5)
          if (colNumber <= 4 && !/^[\d\s\.\,\-]+$/.test(trimmed)) {
            leftColTexts.push(trimmed);
          }
        }
      });

      const leftCombined = leftColTexts.join(' - ').trim();
      // Filtrar cabeceras institucionales que no son preguntas de la matriz
      if (
        leftCombined.length > 6 &&
        !/^(código|codigo|versión|version|fecha|proyecto|localizador|responsable|cliente|semana|mes|año|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|firma|observaciones|notas|convenciones|si|no|na|n\/a|item|ítem|descripcion|descripción)$/i.test(leftCombined)
      ) {
        detectedLeftItems.push(leftCombined);
      }

      if (allRowTexts.length > 0) {
        allLines.push(`Fila ${rowNumber}: ${allRowTexts.join(' | ')}`);
      }
    });

    return {
      leftColumnItems: detectedLeftItems.slice(0, 30),
      fullTextSummary: allLines.slice(0, 45).join('\n'),
    };
  } catch (err) {
    console.warn(`No se pudo extraer texto de la plantilla ${templateFileId}:`, err);
    return { leftColumnItems: [], fullTextSummary: '' };
  }
}

