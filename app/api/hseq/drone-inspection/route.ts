/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { buildDroneInspectionPdf, DRONE_INSPECTION_ITEMS } from '@/lib/drone-inspection';
import { HSEQ_EVIDENCE_FOLDER_ID } from '@/lib/hseq-drive';

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
      droneBrandModel = 'DJI Mavic 3 Enterprise',
      droneSerial = '',
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

    // Validar que los 25 ítems estén respondidos
    const missingCodes = DRONE_INSPECTION_ITEMS.filter(
      (it) => !itemsResponses[it.code]
    ).map((it) => it.code);

    if (missingCodes.length > 0) {
      return NextResponse.json(
        {
          error: `Faltan ${missingCodes.length} ítems por evaluar (${missingCodes.slice(0, 5).join(', ')}...). Todos los 25 ítems son obligatorios.`,
        },
        { status: 400 }
      );
    }

    // 1. Generar el PDF Oficial de Inspección
    const { fileName, pdfBase64, pdfBuffer } = await buildDroneInspectionPdf({
      projectName: projectName || 'Proyecto',
      costCenter: costCenter || '',
      location: location || '',
      inspectionDate,
      droneBrandModel,
      droneSerial,
      itemsResponses,
      criticalPoint,
      generalObservations,
      operatorName,
      operatorSignatureDataUrl,
      sstaName,
      sstaSignatureDataUrl,
    });

    let driveFileId: string | null = null;
    let driveWebViewLink: string | null = null;
    let driveWarning: string | null = null;

    // 2. Intentar guardar copia en Google Drive (Carpeta de Evidencias)
    try {
      const { Readable } = await import('stream');
      const { google } = await import('googleapis');
      const base64Key = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;

      if (base64Key) {
        const credentials = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf-8'));
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const uploadRes = await drive.files.create({
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
            await drive.permissions.create({
              fileId: driveFileId,
              requestBody: { role: 'reader', type: 'anyone' },
            });
          } catch {
            // Ignorar
          }
        }
      }
    } catch (dErr: unknown) {
      const msg = dErr instanceof Error ? dErr.message : String(dErr);
      console.warn('Aviso guardando en Google Drive:', msg);
      driveWarning = msg || 'No se pudo subir copia a Google Drive';
    }

    // 3. Persistir en la Base de Datos Supabase (Ley 1 de PROCIMEC)
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
        drone_brand_model: droneBrandModel,
        drone_serial: droneSerial || null,
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
      // Si la tabla aún no fue corrida en el SQL editor, devolver el PDF generado con aviso
      return NextResponse.json({
        ok: true,
        recordId: null,
        fileName,
        pdfBase64,
        webViewLink: driveWebViewLink,
        dbWarning: `El registro se generó en PDF, pero la tabla hseq_drone_inspections requiere ejecutar la migración 015 en Supabase: ${dbErr.message}`,
        driveWarning,
      });
    }

    return NextResponse.json({
      ok: true,
      recordId: inserted?.id,
      fileName,
      pdfBase64,
      webViewLink: driveWebViewLink,
      driveWarning,
      message: '¡Inspección Pre-operacional de Drone registrada con éxito y PDF generado!',
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
