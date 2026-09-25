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

  const role = session.user.role;
  if (!role || role === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente o no autorizado' }, { status: 403 });
  }

  // Solo roles técnicos y administradores pueden iniciar sesiones de subida de archivos GPR/CAD/HSEQ
  const allowedUploadRoles = ['admin', 'localizador', 'operator', 'dibujo', 'drawing', 'hseq'];
  if (!allowedUploadRoles.includes(role)) {
    return NextResponse.json({ error: 'No tienes permisos para cargar archivos técnicos' }, { status: 403 });
  }

  try {
    const { folderId, fileName, mimeType, fileSize, action, fileId } = await request.json();

    if (action === 'set_permission') {
      if (!fileId) {
        return NextResponse.json({ error: 'fileId es requerido' }, { status: 400 });
      }
      const { webViewLink } = await setFilePublicPermission(fileId);
      return NextResponse.json({ webViewLink });
    }

    if (!folderId || !fileName || !fileSize) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (folderId, fileName, fileSize)' }, { status: 400 });
    }

    const numSize = Number(fileSize);
    // Limitar subida a máximo 1.5 GB por archivo GPR
    if (isNaN(numSize) || numSize <= 0 || numSize > 1500 * 1024 * 1024) {
      return NextResponse.json({ error: 'Tamaño de archivo inválido o excede el límite permitido (1.5GB)' }, { status: 400 });
    }

    const sanitizedFileName = String(fileName).replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const { uploadUrl } = await createResumableUploadSession(
      folderId,
      sanitizedFileName,
      mimeType || 'application/octet-stream',
      numSize
    );

    return NextResponse.json({ uploadUrl });
  } catch (err) {
    console.error('Upload session error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al crear sesión de subida' }, { status: 500 });
  }
}
