import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createResumableUploadSession, setFilePublicPermission } from '@/lib/drive';

// POST /api/drive/upload-session — Creates Google Drive Resumable Upload session for client
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { folderId, fileName, mimeType, fileSize, action, fileId } = await request.json();

    if (action === 'set_permission' && fileId) {
      const { webViewLink } = await setFilePublicPermission(fileId);
      return NextResponse.json({ webViewLink });
    }

    if (!folderId || !fileName || !fileSize) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (folderId, fileName, fileSize)' }, { status: 400 });
    }

    const { uploadUrl } = await createResumableUploadSession(
      folderId,
      fileName,
      mimeType || 'application/octet-stream',
      fileSize
    );

    return NextResponse.json({ uploadUrl });
  } catch (err) {
    console.error('Upload session error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al crear sesión de subida' }, { status: 500 });
  }
}
