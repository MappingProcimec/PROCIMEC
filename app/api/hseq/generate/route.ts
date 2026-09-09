import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateHseqEvidencePdf, InspectionMatrixItem } from '@/lib/hseq-drive';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      templateFileId,
      templateCode = 'FOR-HSEQ',
      projectName = 'Proyecto General',
      locatorName = session.user.name || 'Localizador',
      inspectionDate = new Date().toISOString().split('T')[0],
      notes = '',
      textPlaceholders = {},
      matrixItems = [] as InspectionMatrixItem[],
    } = body;

    if (!templateFileId) {
      return NextResponse.json(
        { error: 'Debe especificar el templateFileId de la plantilla en Google Drive' },
        { status: 400 }
      );
    }

    // Combinar los marcadores de texto con notas y datos del usuario
    const mergedPlaceholders: Record<string, string> = {
      FECHA: inspectionDate,
      PROYECTO: projectName,
      LOCALIZADOR: locatorName,
      RESPONSABLE: locatorName,
      OBSERVACIONES: notes,
      NOTAS: notes,
      ...textPlaceholders,
    };

    const result = await generateHseqEvidencePdf({
      templateFileId,
      templateCode,
      projectName,
      locatorName,
      inspectionDate,
      textPlaceholders: mergedPlaceholders,
      matrixItems,
    });

    return NextResponse.json({
      ok: true,
      fileId: result.fileId,
      fileName: result.fileName,
      webViewLink: result.webViewLink,
      pdfBase64: result.pdfBase64,
      message: 'Evidencia PDF generada y guardada en la Carpeta General de EVIDENCIAS',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado generando la evidencia PDF';
    console.error('Error en POST /api/hseq/generate:', err);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
