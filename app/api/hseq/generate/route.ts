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

    // Calcular mes y fechas para las etiquetas oficiales de la plantilla Excel
    const dateObj = new Date(inspectionDate + 'T12:00:00');
    const monthNames = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const currentMonth = monthNames[dateObj.getMonth()] || 'MES';

    // Combinar los marcadores de texto con notas y datos del usuario
    const mergedPlaceholders: Record<string, string> = {
      FECHA: inspectionDate,
      fecha: inspectionDate,
      fecha_inspeccion: inspectionDate,
      PROYECTO: projectName,
      proyecto: projectName,
      nombre_proyecto: projectName,
      NOMBRE_PROYECTO: projectName,
      centro_costo: body.costCenter || 'PROCIMEC-HSEQ',
      centro_costos: body.costCenter || 'PROCIMEC-HSEQ',
      CENTRO_COSTO: body.costCenter || 'PROCIMEC-HSEQ',
      ciudad_ubicacion: body.location || 'En campo',
      CIUDAD_UBICACION: body.location || 'En campo',
      fecha_inicio: inspectionDate,
      fecha_fin: inspectionDate,
      mes: currentMonth,
      MES: currentMonth,
      marca_modelo: 'EQUIPO OFICIAL PROCIMEC',
      serial_drone: 'PROC-DRN-01',
      serial: 'PROC-EQ-01',
      LOCALIZADOR: locatorName,
      localizador: locatorName,
      RESPONSABLE: locatorName,
      responsable: locatorName,
      OBSERVACIONES: notes,
      observaciones: notes,
      NOTAS: notes,
      notas: notes,
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
      excelFileName: result.excelFileName,
      webViewLink: result.webViewLink,
      pdfBase64: result.pdfBase64,
      excelBase64: result.excelBase64,
      driveError: result.driveError || null,
      message: result.webViewLink
        ? 'Evidencia oficial guardada con éxito en la Carpeta General de EVIDENCIAS de Google Drive'
        : `Evidencia generada para descarga local (Aviso Drive: ${result.driveError || 'Sin acceso remoto'})`,
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
