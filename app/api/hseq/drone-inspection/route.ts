/* eslint-disable @typescript-eslint/no-explicit-any */
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
      customItems = [],
      customSections = [],
      droneBrandModel,
      droneSerial,
      equipmentBrandModel,
      equipmentSerial,
      serialAkula,
      serialComputadora,
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

    // Resolver configuración del formato (Drone, Estación Total o Dinámico)
    const isDrone =
      templateId === 'hseq-drone-preoperational' ||
      templateId.includes('024') ||
      templateId.toLowerCase().includes('drone');
    const isEstacion =
      templateId === 'hseq-estacion-total' ||
      templateId.includes('025') ||
      templateId.toLowerCase().includes('estacion') ||
      templateId.toLowerCase().includes('estación');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formatConfig: any;

    if (isDrone) {
      formatConfig = getHseqFormatConfig('drone');
    } else if (isEstacion) {
      formatConfig = getHseqFormatConfig('estacion');
    } else if (Array.isArray(customItems) && customItems.length > 0) {
      formatConfig = {
        id: templateId,
        formatType: 'generic',
        code: templateCode || 'FOR-HSEQ',
        title: templateTitle || 'Inspección Pre-operacional',
        pdfTitle: (templateTitle || 'Inspección Pre-operacional').toUpperCase(),
        version: '01',
        equipmentLabel: equipmentBrandModel ? 'Equipo' : 'Equipo / Herramienta',
        defaultEquipment: equipmentBrandModel || 'Equipo Estándar',
        defaultSerial: equipmentSerial || 'PROC-EQ-001',
        sections: customSections.length > 0 ? customSections : ['1. GENERAL'],
        items: customItems,
        isDynamic: true,
      };
    } else {
      try {
        const { parseExcelTemplateSchema } = await import('@/lib/hseq-drive');
        formatConfig = await parseExcelTemplateSchema(templateId);
      } catch {
        formatConfig = getHseqFormatConfig(`${templateId} ${templateCode} ${templateTitle}`);
      }
    }

    // Validar que todos los ítems de este formato específico estén evaluados
    const requiredItems = formatConfig.items || [];
    const missingCodes = requiredItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((it: any) => !itemsResponses[it.code])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => it.code);

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
    const serial =
      serialAkula && serialComputadora
        ? `Akula: ${serialAkula} | PC: ${serialComputadora}`
        : serialAkula || serialComputadora || equipmentSerial || droneSerial || formatConfig.defaultSerial;

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
      serialAkula: serialAkula || undefined,
      serialComputadora: serialComputadora || undefined,
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

    // 3. Almacenamiento y consultas independientes en paralelo (Cero Waterfall I/O)
    const supabase = createAdminClient();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const pdfStoragePath = `pdf/${year}/${month}/${fileName}`;
    const excelStoragePath = `excel/${year}/${month}/${excelFileName}`;

    let pdfUrl: string | null = null;
    let excelUrl: string | null = null;
    let driveFileId: string | null = null;
    let driveWebViewLink: string | null = null;
    const driveWarning: string | null = null;
    let divisionName = formatConfig.formatType === 'drone' ? 'Mapping / Drones' : 'Ingeniería / Topografía';

    // Disparar las 4 operaciones I/O concurrentemente con Promise.allSettled
    const [pdfStorageRes, excelStorageRes, driveUploadRes, userProfileRes] = await Promise.allSettled([
      // Task 1: Subir PDF a Supabase Storage
      supabase.storage.from('evidencias').upload(pdfStoragePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      }),

      // Task 2: Subir Excel (.xlsx) a Supabase Storage
      supabase.storage.from('evidencias').upload(excelStoragePath, excelResult.excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      }),

      // Task 3: Copia en Google Drive (si está configurada)
      (async () => {
        const { Readable } = await import('stream');
        const uploadDrive = await getUploadDriveClient();
        return uploadDrive.files.create({
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
      })(),

      // Task 4: Consultar división del usuario autenticado
      supabase
        .from('users')
        .select('division_id, divisions!users_division_id_fkey(name)')
        .eq('id', session.user.id)
        .single(),
    ]);

    // Procesar resultados de Task 1 (PDF en Supabase Storage)
    if (pdfStorageRes.status === 'fulfilled' && !pdfStorageRes.value.error) {
      pdfUrl = supabase.storage.from('evidencias').getPublicUrl(pdfStoragePath).data.publicUrl;
    } else if (pdfStorageRes.status === 'rejected') {
      console.warn('Aviso guardando PDF en Supabase Storage:', pdfStorageRes.reason);
    }

    // Procesar resultados de Task 2 (Excel en Supabase Storage)
    if (excelStorageRes.status === 'fulfilled' && !excelStorageRes.value.error) {
      excelUrl = supabase.storage.from('evidencias').getPublicUrl(excelStoragePath).data.publicUrl;
    } else if (excelStorageRes.status === 'rejected') {
      console.warn('Aviso guardando Excel en Supabase Storage:', excelStorageRes.reason);
    }

    // Procesar resultados de Task 3 (Google Drive)
    if (driveUploadRes.status === 'fulfilled' && driveUploadRes.value?.data) {
      driveFileId = driveUploadRes.value.data.id || null;
      if (driveUploadRes.value.data.webViewLink) {
        driveWebViewLink = driveUploadRes.value.data.webViewLink;
      }
    }
    // Si no hubo enlace de Drive, usar la URL pública del PDF como respaldo
    if (!driveWebViewLink) {
      driveWebViewLink = pdfUrl;
    }

    // Procesar resultados de Task 4 (División del usuario)
    if (userProfileRes.status === 'fulfilled') {
      interface UserProfileWithDiv {
        division_id?: string | null;
        divisions?: { name?: string } | null;
      }
      const typedProfile = userProfileRes.value.data as unknown as UserProfileWithDiv | null;
      if (typedProfile?.divisions?.name) {
        divisionName = typedProfile.divisions.name;
      }
    }

    // 6. Detectar si hay variaciones respecto a la condición óptima o Puntos Críticos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nonCompliantItems = requiredItems
      .filter((it: any) => {
        if (it.optimal === 'NA') return false;
        const userVal = String(itemsResponses[it.code] || '').toUpperCase();
        return userVal !== it.optimal;
      })
      .map((it: any) => {
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

    const obsClean = (generalObservations || '').trim().toLowerCase();
    const hasCustomObservations =
      Boolean(generalObservations) &&
      !['ninguna', 'ninguno', 'ningun', 'sin observaciones', 'n/a', 'na', ''].includes(obsClean);

    const hasAnomalies = nonCompliantItems.length > 0 || hasCriticalPoint || hasCustomObservations;

    // Disparar correo automático de alerta/notificación al responsable HSEQ si hay variaciones, punto crítico u observaciones
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
        generalObservations: hasCustomObservations ? generalObservations : undefined,
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
        serial_akula: serialAkula || null,
        serial_computadora: serialComputadora || null,
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

    // 7. Persistir en la Base de Datos Supabase (Tabla Canónica hseq_inspections)
    const fullPayload = {
      project_id: projectId,
      user_id: session.user.id,
      status: hasAnomalies ? 'submitted' : 'approved',
      cost_center: costCenter || null,
      location: location || null,
      inspection_date: inspectionDate,
      equipment_brand_model: brandModel,
      equipment_serial: serial || null,
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
      pdf_storage_path: pdfStoragePath,
      pdf_url: pdfUrl,
      division_name: divisionName,
      format_code: formatConfig.code,
      format_title: formatConfig.title,
      excel_filename: excelFileName,
      excel_storage_path: excelStoragePath,
      excel_url: excelUrl,
      has_anomalies: hasAnomalies,
      non_compliant_items: nonCompliantItems,
    };

    let inserted: any = null;
    let dbErr: any = null;

    // Intento 1: Tabla canónica hseq_inspections
    const res1 = await supabase
      .from('hseq_inspections')
      .insert(fullPayload)
      .select()
      .single();

    if (!res1.error) {
      inserted = res1.data;
    } else {
      console.warn('Aviso insertando en hseq_inspections, probando tabla hseq_drone_inspections:', res1.error.message);
      // Intento 2: Tabla hseq_drone_inspections con payload completo
      const res2 = await supabase
        .from('hseq_drone_inspections')
        .insert(fullPayload)
        .select()
        .single();

      if (!res2.error) {
        inserted = res2.data;
      } else {
        console.warn('Aviso insertando con payload completo en hseq_drone_inspections, aplicando fallback resiliente:', res2.error.message);
        // Intento 3: Columnas base en hseq_drone_inspections (por si faltan columnas de migración 016 en Supabase)
        const basePayload = {
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
        };

        const res3 = await supabase
          .from('hseq_drone_inspections')
          .insert(basePayload)
          .select()
          .single();

        if (!res3.error) {
          inserted = res3.data;
        } else {
          dbErr = res3.error;
          console.error('Error definitivo insertando inspección en base de datos:', dbErr);
        }
      }
    }

    if (dbErr) {
      console.error('Error insertando inspección en BD:', dbErr);
      return NextResponse.json({
        ok: true,
        recordId: null,
        fileName,
        pdfBase64,
        excelFileName,
        excelBase64,
        webViewLink: driveWebViewLink,
        dbWarning: `El registro se generó en PDF y Excel oficial, pero la tabla hseq_inspections requiere ejecutar la migración 017 en Supabase: ${dbErr.message}`,
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
