import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scanHseqTemplates, HSEQ_TEMPLATES_FOLDER_ID, HseqTemplateItem } from '@/lib/hseq-drive';

// Fallback de contingencia con formatos estándar conocidos si Drive API no responde
const FALLBACK_TEMPLATES: HseqTemplateItem[] = [
  {
    id: 'fallback-012',
    name: 'FOR-HSEQ-012 Inspeccion Preoperacional de Alturas.xlsx',
    code: 'FOR-HSEQ-012',
    title: 'Inspección Preoperacional de Alturas',
    folderId: HSEQ_TEMPLATES_FOLDER_ID,
    folderName: 'Alturas',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    id: 'fallback-005',
    name: 'FOR-HSEQ-005 Lista de Chequeo y Dotacion de EPP.xlsx',
    code: 'FOR-HSEQ-005',
    title: 'Lista de Chequeo y Dotación de EPP',
    folderId: HSEQ_TEMPLATES_FOLDER_ID,
    folderName: 'EPP',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    id: 'fallback-021',
    name: 'FOR-HSEQ-021 Permiso de Trabajo Seguro en Via o Campo.xlsx',
    code: 'FOR-HSEQ-021',
    title: 'Permiso de Trabajo Seguro en Vía o Campo',
    folderId: HSEQ_TEMPLATES_FOLDER_ID,
    folderName: 'Permisos',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    id: 'fallback-008',
    name: 'FOR-HSEQ-008 Inspeccion Preoperacional de Vehiculo y Equipo.xlsx',
    code: 'FOR-HSEQ-008',
    title: 'Inspección Preoperacional de Vehículo y Equipo',
    folderId: HSEQ_TEMPLATES_FOLDER_ID,
    folderName: 'Inspecciones',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

  try {
    const templates = await scanHseqTemplates(refresh);
    return NextResponse.json({
      ok: true,
      count: templates.length,
      folderId: HSEQ_TEMPLATES_FOLDER_ID,
      templates: templates.length > 0 ? templates : FALLBACK_TEMPLATES,
      source: templates.length > 0 ? 'google_drive' : 'fallback',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al conectar con Google Drive';
    console.warn('Advertencia escaneando Drive HSEQ (usando fallback de contingencia):', message);

    return NextResponse.json({
      ok: true,
      count: FALLBACK_TEMPLATES.length,
      folderId: HSEQ_TEMPLATES_FOLDER_ID,
      templates: FALLBACK_TEMPLATES,
      source: 'fallback',
      warning: message,
    });
  }
}
