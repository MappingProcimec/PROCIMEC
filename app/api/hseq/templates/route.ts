import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scanHseqTemplates, HSEQ_TEMPLATES_FOLDER_ID } from '@/lib/hseq-drive';

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
      templates,
      source: 'google_drive',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al conectar con Google Drive';
    console.error('Error escaneando Drive HSEQ:', message);

    return NextResponse.json({
      ok: false,
      count: 0,
      folderId: HSEQ_TEMPLATES_FOLDER_ID,
      templates: [],
      error: message,
    }, { status: 500 });
  }
}
