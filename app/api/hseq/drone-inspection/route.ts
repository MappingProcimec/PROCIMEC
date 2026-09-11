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
import { sendHseqAlertEmail } from '@/lib/hseq-mailer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // 3. Almacenar Evidencias en Supabase Storage (Bucket 'evidencias')
    const supabase = createAdminClient();
    let pdfUrl: string | null = null;
    let excelUrl: string | null = null;

    try {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const pdfStoragePath = `pdf/${year}/${month}/${fileName}`;
      const excelStoragePath = `excel/${year}/${month}/${excelFileName}`;

      // Subir PDF a bucket de evidencias
      const pdfUpload = await supabase.storage.from('evidencias').upload(pdfStoragePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (!pdfUpload.error) {
        pdfUrl = supabase.storage.from('evidencias').getPublicUrl(pdfStoragePath).data.publicUrl;
      }

      // Subir Excel (.xlsx) a bucket de evidencias
      const excelUpload = await supabase.storage.from('evidencias').upload(excelStoragePath, excelResult.excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });
      if (!excelUpload.error) {
        excelUrl = supabase.storage.from('evidencias').getPublicUrl(excelStoragePath).data.publicUrl;
      }
    } catch (sErr) {
      console.warn('Aviso guardando evidencias en Supabase Storage:', sErr);
    }

    let driveFileId: string | null = null;
    let driveWebViewLink: string | null = pdfUrl;
    const driveWarning: string | null = null;

    // 4. Intentar guardar copia complementaria en Google Drive (si está disponible)
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
      if (uploadRes.data.webViewLink) {
        driveWebViewLink = uploadRes.data.webViewLink;
      }
    } catch {
      // Ignorar error de cuota en Drive personal; la evidencia ya quedó respaldada en Supabase Storage
    }

    // 5. Determinar División del Usuario y Formulario
    let divisionName = formatConfig.formatType === 'drone' ? 'Mapping / Drones' : 'Ingeniería / Topografía';
    try {
      interface UserProfileWithDiv {
        division_id?: string | null;
        divisions?: { name?: string } | null;
      }
      const { data: userProfile } = await supabase
        .from('users')
        .select('division_id, divisions!users_division_id_fkey(name)')
        .eq('id', session.user.id)
        .single();
      const typedProfile = userProfile as unknown as UserProfileWithDiv | null;
      if (typedProfile?.divisions?.name) {
        divisionName = typedProfile.divisions.name;
      }
    } catch {}

    // 6. Detectar si hay variaciones respecto a la condición óptima o Puntos Críticos
    const nonCompliantItems = requiredItems
      .filter((it) => {
        if (it.optimal === 'NA') return false;
        const userVal = String(itemsResponses[it.code] || '').toUpperCase();
        return userVal !== it.optimal;
      })
      .map((it) => {
        const itemObj = it as unknown as { code: string; description?: string; title?: string; optimal: string };
        return {
          code: itemObj.code,
          description: itemObj.description || itemObj.title || '',
          response: String(itemsResponses[it.code] || '').toUpperCase(),
          expected: itemObj.optimal,
        };
      });

    const hasCriticalPoint =
      Boolean(criticalPoint) &&
      criticalPoint.trim().toLowerCase() !== 'ninguno' &&
      criticalPoint.trim().toLowerCase() !== 'ninguna' &&
      criticalPoint.trim() !== '';

    const hasAnomalies = nonCompliantItems.length > 0 || hasCriticalPoint;

    // Disparar correo automático de alerta al responsable HSEQ si hay variaciones o punto crítico
    if (hasAnomalies) {
      sendHseqAlertEmail({
        formatCode: formatConfig.code,
        formatTitle: formatConfig.title,
        projectName: projectName || 'Proyecto General',
        costCenter,
        location,
        inspectionDate,
        equipmentBrandModel: brandModel,
        equipmentSerial: serial,
        operatorName,
        sstaName,
        variations: nonCompliantItems,
        criticalPoint: hasCriticalPoint ? criticalPoint : undefined,
        generalObservations,
        pdfUrl: pdfUrl || driveWebViewLink || undefined,
        excelUrl: excelUrl || undefined,
      }).catch((mailErr) => {
        console.error('Error despachando correo de alerta HSEQ:', mailErr);
      });
    }

    // Enriquecer items_responses con metadatos completos para el tablero
    const enrichedItemsResponses = {
      ...itemsResponses,
      _meta: {
        division: divisionName,
        format_code: formatConfig.code,
        format_title: formatConfig.title,
        equipment_label: formatConfig.equipmentLabel,
        equipment_brand_model: brandModel,
        equipment_serial: serial,
        pdf_filename: fileName,
        pdf_url: pdfUrl,
        excel_filename: excelFileName,
        excel_url: excelUrl,
        has_anomalies: hasAnomalies,
        non_compliant_count: nonCompliantItems.length,
        non_compliant_items: nonCompliantItems,
        critical_point: criticalPoint || 'Ninguno',
        general_observations: generalObservations || '',
        created_at: new Date().toISOString(),
      },
    };

    // 7. Persistir en la Base de Datos Supabase (Ley 1 de PROCIMEC)
    const { data: inserted, error: dbErr } = await supabase
      .from('hseq_drone_inspections')
      .insert({
        project_id: projectId,
        user_id: session.user.id,
        status: hasAnomalies ? 'submitted' : 'approved',
        cost_center: costCenter || null,
        location: location || null,
        inspection_date: inspectionDate,
        drone_brand_model: brandModel,
        drone_serial: serial || null,
        items_responses: enrichedItemsResponses,
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
      pdfUrl,
      excelUrl,
      divisionName,
      hasAnomalies,
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
