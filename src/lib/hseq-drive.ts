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
