import { google } from 'googleapis';
import { DriveFolder, DriveFile } from '@/types';
import { Readable } from 'stream';

function getAuthClient() {
  const base64Key = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!base64Key) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY not set');

  const credentials = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return auth;
}

export function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}

// ─── Create a folder ─────────────────────────────────────────────────────────
export async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name, webViewLink',
  });

  // Make folder readable by anyone with link
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    webViewLink: res.data.webViewLink!,
  };
}

// ─── Create project folder in root ────────────────────────────────────────────
export async function createProjectFolder(
  projectCode: string,
  projectName: string
): Promise<DriveFolder> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID not set');

  const folderName = `${projectCode}_${projectName.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 50)}`;
  return createFolder(folderName, rootFolderId);
}

// ─── Create session folder ────────────────────────────────────────────────────
export async function createSessionFolder(
  projectFolderId: string,
  operatorLastName: string,
  datetime: Date
): Promise<{ sessionFolder: DriveFolder; rawGprFolder: DriveFolder; gpsFolder: DriveFolder; photosFolder: DriveFolder }> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = datetime;
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const lastName = operatorLastName.split(' ').pop()?.toUpperCase() || 'OP';
  const sessionName = `${dateStr}_${timeStr}_${lastName}`;

  const sessionFolder = await createFolder(sessionName, projectFolderId);
  const [rawGprFolder, gpsFolder, photosFolder] = await Promise.all([
    createFolder('01_RAW_GPR', sessionFolder.id),
    createFolder('02_POSICIONAMIENTO', sessionFolder.id),
    createFolder('03_FOTOGRAFIAS', sessionFolder.id),
  ]);

  return { sessionFolder, rawGprFolder, gpsFolder, photosFolder };
}

// ─── Upload file ──────────────────────────────────────────────────────────────
export async function uploadFileToDrive(
  folderId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<DriveFile> {
  const drive = getDriveClient();

  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, webViewLink, webContentLink, size',
  });

  // Make file readable
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    webViewLink: res.data.webViewLink!,
    webContentLink: res.data.webContentLink!,
    size: res.data.size || undefined,
  };
}

// ─── Get file metadata ────────────────────────────────────────────────────────
export async function getFileMetadata(fileId: string): Promise<DriveFile | null> {
  try {
    const drive = getDriveClient();
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, webViewLink, webContentLink, size',
    });
    return {
      id: res.data.id!,
      name: res.data.name!,
      webViewLink: res.data.webViewLink!,
      webContentLink: res.data.webContentLink!,
      size: res.data.size || undefined,
    };
  } catch {
    return null;
  }
}
