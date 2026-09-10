import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import {
  fillHseqExcelTemplate,
  getHseqFormatConfig,
} from '@/lib/drone-inspection';
import { convertOfficeDocumentToPdf } from '@/lib/cloud-document-converter';
import { HSEQ_EVIDENCE_FOLDER_ID, getUploadDriveClient } from '@/lib/hseq-drive';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      projectId,
      projectName,
      costCenter,
      location,
      inspectionDate = new Date().toISOString().split('T')[0],
      templateId = '',
      templateCode = '',
      templateTitle = '',
      droneBrandModel,
      droneSerial,
      equipmentBrandModel,
      equipmentSerial,
      itemsResponses = {},
      criticalPoint = 'Ninguno',
      generalObservations = '',
      operatorName,
      operatorSignatureDataUrl,
      sstaName,
      sstaSignatureDataUrl,
    } = body;

    // Validar proyecto
    if (!projectId) {
      return NextResponse.json(
        { error: 'Debe seleccionar un proyecto válido asignado a su usuario.' },
        { status: 400 }
      );
    }

    // Validar firmas digitales obligatorias
    if (!operatorName || !operatorSignatureDataUrl) {
      return NextResponse.json(
        { error: 'La firma digital del Operador es obligatoria con nombre completo verificado.' },
        { status: 400 }
      );
    }

    if (!sstaName || !sstaSignatureDataUrl) {
      return NextResponse.json(
        { error: 'La firma digital del Responsable SSTA es obligatoria con nombre completo verificado.' },
        { status: 400 }
      );
    }

    // Resolver configuración del formato seleccionado
    const formatIdentifier = `${templateId} ${templateCode} ${templateTitle}`;
    const formatConfig = getHseqFormatConfig(formatIdentifier);

    // Validar que todos los ítems de este formato específico estén evaluados
    const requiredItems = formatConfig.items;
    const missingCodes = requiredItems
      .filter((it) => !itemsResponses[it.code])
      .map((it) => it.code);

    if (missingCodes.length > 0) {
      return NextResponse.json(
        {
          error: `Faltan ${missingCodes.length} ítems por evaluar (${missingCodes.slice(0, 5).join(', ')}...). Todos los ${requiredItems.length} ítems son obligatorios.`,
        },
        { status: 400 }
      );
    }

    const brandModel =
      equipmentBrandModel || droneBrandModel || formatConfig.defaultEquipment;
    const serial = equipmentSerial || droneSerial || formatConfig.defaultSerial;

    const payloadForGeneration = {
      formatTitle: formatConfig.pdfTitle,
      formatCode: formatConfig.code,
      version: formatConfig.version,
      equipmentLabel: formatConfig.equipmentLabel,
      projectName: projectName || 'Proyecto',
      costCenter: costCenter || '',
      location: location || '',
      inspectionDate,
      equipmentBrandModel: brandModel,
      equipmentSerial: serial,
      items: requiredItems,
      itemsResponses,
      criticalPoint,
      generalObservations,
      operatorName,
      operatorSignatureDataUrl,
      sstaName,
      sstaSignatureDataUrl,
      templateType: formatConfig.formatType,
      templateId: templateId || undefined,
    };

    // 1. Abrir la plantilla Excel oficial de Carpeta 24 y diligenciar sus celdas
    const excelResult = await fillHseqExcelTemplate(payloadForGeneration);
    const excelFileName = excelResult.fileName;
    const excelBase64 = excelResult.excelBase64;

    // 2. Convertir la hoja Excel ya diligenciada directamente a PDF (Solución B con fallback A1)
    const { fileName, pdfBase64, pdfBuffer, conversionMethod } = await convertOfficeDocumentToPdf(
      excelResult.excelBuffer,
      excelResult.worksheet,
      payloadForGeneration
    );

    let driveFileId: string | null = null;
    let driveWebViewLink: string | null = null;
    let driveWarning: string | null = null;

    // 3. Intentar guardar copia en Google Drive (Carpeta de Evidencias)
    try {
      const { Readable } = await import('stream');
      const uploadDrive = await getUploadDriveClient();

      const uploadRes = await uploadDrive.files.create({
        requestBody: {
          name: fileName,
          parents: [HSEQ_EVIDENCE_FOLDER_ID],
          mimeType: 'application/pdf',
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(pdfBuffer),
        },
        fields: 'id, name, webViewLink',
      });

      driveFileId = uploadRes.data.id || null;
      driveWebViewLink = uploadRes.data.webViewLink || null;

      // Otorgar permisos de lectura compartida
      if (driveFileId) {
        try {
          await uploadDrive.permissions.create({
            fileId: driveFileId,
            requestBody: { role: 'reader', type: 'anyone' },
          });
        } catch {
          // Ignorar
        }
      }
    } catch (dErr: unknown) {
      const msg = dErr instanceof Error ? dErr.message : String(dErr);
      console.warn('Aviso guardando en Google Drive:', msg);
      driveWarning =
        'Para sincronizar directamente en la carpeta de Google Drive en la nube, el administrador debe renovar su sesión en la plataforma. Tu reporte oficial está listo para descarga local inmediata.';
    }

    // 4. Persistir en la Base de Datos Supabase (Ley 1 de PROCIMEC)
    const supabase = createAdminClient();
    const { data: inserted, error: dbErr } = await supabase
      .from('hseq_drone_inspections')
      .insert({
        project_id: projectId,
        user_id: session.user.id,
        status: 'submitted',
        cost_center: costCenter || null,
        location: location || null,
        inspection_date: inspectionDate,
        drone_brand_model: brandModel,
        drone_serial: serial || null,
        items_responses: itemsResponses,
        critical_point: criticalPoint || 'Ninguno',
        general_observations: generalObservations || null,
        operator_name: operatorName,
        operator_signature_data: operatorSignatureDataUrl,
        ssta_name: sstaName,
        ssta_signature_data: sstaSignatureDataUrl,
        drive_file_id: driveFileId,
        drive_web_view_link: driveWebViewLink,
        pdf_filename: fileName,
      })
      .select()
      .single();

    if (dbErr) {
      console.error('Error insertando en hseq_drone_inspections:', dbErr);
      return NextResponse.json({
        ok: true,
        recordId: null,
        fileName,
        pdfBase64,
        excelFileName,
        excelBase64,
        webViewLink: driveWebViewLink,
        dbWarning: `El registro se generó en PDF y Excel oficial, pero la tabla hseq_drone_inspections requiere ejecutar la migración 015 en Supabase: ${dbErr.message}`,
        driveWarning,
      });
    }

    return NextResponse.json({
      ok: true,
      recordId: inserted?.id,
      fileName,
      pdfBase64,
      excelFileName,
      excelBase64,
      webViewLink: driveWebViewLink,
      driveWarning,
      conversionMethod,
      message: `¡${formatConfig.title} registrada con éxito y formatos generados!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado procesando la inspección de drone.';
    console.error('Error procesando inspección de drone:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
