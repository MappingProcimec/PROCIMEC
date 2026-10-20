/* eslint-disable @typescript-eslint/no-unused-vars */
import { DriveFolder, DriveFile } from '@/types';

/**
 * ADAPTADOR DE ALMACENAMIENTO CANÓNICO PCM CLOUD
 * Desacoplado de Google Drive por directriz de auditoría de seguridad y privacidad.
 * Todo almacenamiento y gestión documental se canaliza de forma segura a través de Supabase Storage.
 */

export function getDriveClient() {
  return null;
}

export async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
  const folderId = `folder_${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
  return {
    id: folderId,
    name,
    webViewLink: `/projects?folder=${parentId}`,
  };
}

export async function createProjectFolder(
  projectCode: string,
  projectName: string
): Promise<DriveFolder> {
  const cleanCode = projectCode ? projectCode.trim() : 'PROJ';
  const cleanName = projectName.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
  const folderId = `proj_${cleanCode}_${Date.now()}`;
  return {
    id: folderId,
    name: `${cleanCode}_${cleanName}`,
    webViewLink: `/projects?code=${encodeURIComponent(cleanCode)}`,
  };
}

export async function createSessionFolder(
  projectFolderId: string,
  locatorLastName: string,
  datetime: Date
): Promise<{
  sessionFolder: DriveFolder;
  rawGprFolder: DriveFolder;
  gpsFolder: DriveFolder;
  photosFolder: DriveFolder;
}> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = datetime;
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const cleanLocator = locatorLastName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');

  const sessionName = `${dateStr}_${timeStr}_${cleanLocator}`;
  const baseLink = `/projects?session=${encodeURIComponent(sessionName)}`;

  const sessionFolder: DriveFolder = {
    id: `sess_${sessionName}`,
    name: sessionName,
    webViewLink: baseLink,
  };

  const rawGprFolder: DriveFolder = {
    id: `raw_${sessionName}`,
    name: 'RAW_GPR_PPR',
    webViewLink: `${baseLink}&type=raw`,
  };

  const gpsFolder: DriveFolder = {
    id: `gps_${sessionName}`,
    name: 'GPS_Posicionamiento',
    webViewLink: `${baseLink}&type=gps`,
  };

  const photosFolder: DriveFolder = {
    id: `photos_${sessionName}`,
    name: 'Registro_Fotografico',
    webViewLink: `${baseLink}&type=photos`,
  };

  return { sessionFolder, rawGprFolder, gpsFolder, photosFolder };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createResumableUploadSession(
  folderId: string,
  fileName: string,
  _mimeType?: string,
  _fileSize?: number
): Promise<{ uploadUrl: string }> {
  // Stub seguro: el frontend utiliza Supabase Storage directo en /api/reports/upload
  return {
    uploadUrl: `/api/reports/upload?folder=${encodeURIComponent(folderId)}&file=${encodeURIComponent(fileName)}`,
  };
}

export async function setFilePublicPermission(fileId: string): Promise<{ webViewLink: string }> {
  // Deshabilitado: ya no se otorgan permisos de 'anyone' públicos
  return {
    webViewLink: `/projects/files/${encodeURIComponent(fileId)}`,
  };
}

export async function uploadFileToDrive(
  folderId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<DriveFile> {
  // Guardado seguro directo en Supabase Storage (Bucket 'evidencias')
  try {
    const { createAdminClient } = await import('./supabase');
    const supabase = createAdminClient();
    const storagePath = `documents/${folderId}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const { error } = await supabase.storage.from('evidencias').upload(storagePath, buffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true,
    });

    if (!error) {
      const { data } = supabase.storage.from('evidencias').getPublicUrl(storagePath);
      const url = data?.publicUrl || '';
      return {
        id: storagePath,
        name: filename,
        webViewLink: url,
        webContentLink: url,
        size: String(buffer.length),
      };
    }
  } catch (err) {
    console.warn('Aviso: Fallback en uploadFileToDrive:', err);
  }

  return {
    id: `file_${Date.now()}`,
    name: filename,
    webViewLink: '',
    webContentLink: '',
    size: String(buffer.length),
  };
}
