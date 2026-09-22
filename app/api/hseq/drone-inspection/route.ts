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

function normalizeDivision(rawName?: string | null): 'Mapping' | 'Ingeniería' {
  if (!rawName) return 'Mapping';
  const norm = rawName.trim().toLowerCase();
  if (norm.includes('mapping')) {
    return 'Mapping';
  }
  if (
    norm.startsWith('ing') ||
    norm.includes('ingenier') ||
    norm.includes('topo') ||
    norm.includes('geof') ||
    norm.includes('cad') ||
    norm.includes('bim')
  ) {
    return 'Ingeniería';
  }
  return 'Mapping';
}

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
      templateVersion,
      templateDate,
      customItems = [],
      customSections = [],
      equipmentName,
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
        { error: 'La firma digital del Responsable/SSTA es obligatoria con nombre completo verificado.' },
        { status: 400 }
      );
    }

    // Resolver configuración del formato (Drone, Estación Total o Dinámico)
    const combinedStr = `${templateId || ''} ${templateCode || ''} ${templateTitle || ''}`.toLowerCase();
    const isDrone =
      templateId === 'hseq-drone-preoperational' ||
      combinedStr.includes('024') ||
      combinedStr.includes('drone') ||
      combinedStr.includes('dron');
    const isEstacion =
      templateId === 'hseq-estacion-total' ||
      combinedStr.includes('025') ||
      combinedStr.includes('estacion') ||
      combinedStr.includes('estación');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formatConfig: any;

    if (isDrone) {
      formatConfig = getHseqFormatConfig('drone');
      if (templateVersion) formatConfig.version = templateVersion;
      if (templateDate) formatConfig.templateDate = templateDate;
    } else if (isEstacion) {
      formatConfig = getHseqFormatConfig('estacion');
      if (templateVersion) formatConfig.version = templateVersion;
      if (templateDate) formatConfig.templateDate = templateDate;
    } else if (Array.isArray(customItems) && customItems.length > 0) {
      formatConfig = {
        id: templateId,
        formatType: 'generic',
        code: templateCode || 'FOR-HSEQ',
        title: templateTitle || 'Inspección Pre-operacional',
        pdfTitle: (templateTitle || 'Inspección Pre-operacional').toUpperCase(),
        version: templateVersion || '2',
        templateDate: templateDate || '16-sep-2026',
        equipmentLabel: equipmentBrandModel ? 'Equipo' : 'Equipo / Herramienta',
        equipmentName: equipmentName || 'Equipo',
        division: isDrone ? 'Mapping' : 'Ingeniería',
        defaultEquipment: equipmentBrandModel || 'Equipo Estándar',
        defaultSerial: equipmentSerial || '',
        sections: customSections.length > 0 ? customSections : ['1. GENERAL'],
        items: customItems,
        isDynamic: true,
      };
    } else {
      try {
        const { parseExcelTemplateSchema } = await import('@/lib/hseq-drive');
        formatConfig = await parseExcelTemplateSchema(templateId);
        if (templateVersion) formatConfig.version = templateVersion;
        if (templateDate) formatConfig.templateDate = templateDate;
      } catch {
        formatConfig = getHseqFormatConfig(`${templateId} ${templateCode} ${templateTitle}`);
        if (templateVersion) formatConfig.version = templateVersion;
        if (templateDate) formatConfig.templateDate = templateDate;
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

    // Separación canónica y validación estricta de Equipo, Marca/Modelo y Serial
    const effectiveEquipmentName = (
      equipmentName ||
      formatConfig.equipmentName ||
      (isDrone ? 'Drone' : isEstacion ? 'Estación Total' : 'Equipo')
    ).trim();

    const brandModel = (
      equipmentBrandModel ||
      droneBrandModel ||
      ''
    ).trim();

    const serial = (
      serialAkula && serialComputadora
        ? `Akula: ${serialAkula} | PC: ${serialComputadora}`
        : serialAkula || serialComputadora || equipmentSerial || droneSerial || ''
    ).trim();

    if (!effectiveEquipmentName) {
      return NextResponse.json(
        { error: 'El campo Equipo / Herramienta es obligatorio.' },
        { status: 400 }
      );
    }

    if (!brandModel) {
      return NextResponse.json(
        { error: 'La Marca y Modelo del equipo es obligatoria.' },
        { status: 400 }
      );
    }

    if (!serial) {
      return NextResponse.json(
        { error: 'El Número de Serial del equipo es obligatorio.' },
        { status: 400 }
      );
    }

    const payloadForGeneration = {
      formatTitle: formatConfig.pdfTitle,
      formatCode: formatConfig.code,
      version: formatConfig.version,
      templateVersion: formatConfig.version,
      templateDate: formatConfig.templateDate,
      equipmentName: effectiveEquipmentName,
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
    const rawDivision = (isDrone ? 'Mapping' : formatConfig.division) || (formatConfig.formatType === 'drone' ? 'Mapping' : 'Ingeniería');

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

      // Task 4: Consultar división y rol del usuario autenticado
      supabase
        .from('users')
        .select('role, division_id, roles(id, name), divisions!users_division_id_fkey(name)')
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

    // Procesar resultados de Task 4: La división canónica del formato tiene prioridad absoluta sobre la cuenta del usuario
    interface UserProfileWithDivAndRole {
      role?: string | null;
      roles?: { id?: string; name?: string } | null;
      division_id?: string | null;
      divisions?: { name?: string } | null;
    }
    const typedProfile =
      userProfileRes.status === 'fulfilled'
        ? (userProfileRes.value.data as unknown as UserProfileWithDivAndRole | null)
        : null;

    let effectiveDivision = isDrone ? 'Mapping' : formatConfig.division;
    if (!effectiveDivision && typedProfile?.divisions?.name) {
      effectiveDivision = typedProfile.divisions.name;
    }
    const divisionName = isDrone ? 'Mapping' : normalizeDivision(effectiveDivision || rawDivision);

    // Resolver y normalizar rol del usuario que llenó la inspección
    const rawRole =
      body.userRole ||
      typedProfile?.roles?.name ||
      typedProfile?.role ||
      (session.user as any)?.role ||
      'Operador';
    const roleCapitalized =
      rawRole === 'admin'
        ? 'Administrador'
        : rawRole === 'localizador'
        ? 'Localizador'
        : rawRole === 'operator'
        ? 'Operador'
        : rawRole === 'dibujo'
        ? 'Dibujo'
        : String(rawRole);

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
          description: itemObj.description || itemObj.title || itemObj.code,
          expected: itemObj.optimal,
          actual: String(itemsResponses[itemObj.code] || '').toUpperCase(),
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
        user_role: roleCapitalized,
        operator_role: roleCapitalized,
        format_code: formatConfig.code,
        format_title: formatConfig.title,
        equipment_name: effectiveEquipmentName,
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
      equipment_name: effectiveEquipmentName,
      equipment_brand_model: brandModel,
      equipment_serial: serial || null,
      items_responses: enrichedItemsResponses,
      critical_point: criticalPoint || 'Ninguno',
      general_observations: generalObservations || null,
      operator_name: operatorName,
      operator_role: roleCapitalized,
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

    // Intento 1: Tabla canónica hseq_inspections con payload completo (incluyendo equipment_name y operator_role)
    const res1 = await supabase
      .from('hseq_inspections')
      .insert(fullPayload)
      .select()
      .single();

    if (!res1.error) {
      inserted = res1.data;
    } else {
      console.warn('Aviso insertando con payload completo en hseq_inspections, aplicando fallback resiliente:', res1.error.message);
      // Intento 2: Fallback omitiendo columnas opcionales si aún no han sido migradas
      const basePayloadWithoutEquipmentName = { ...fullPayload };
      delete (basePayloadWithoutEquipmentName as any).equipment_name;
      delete (basePayloadWithoutEquipmentName as any).operator_role;
      const res2 = await supabase
        .from('hseq_inspections')
        .insert(basePayloadWithoutEquipmentName)
        .select()
        .single();

    if (!res2.error) {
      inserted = res2.data;
    } else {
      dbErr = res2.error;
      console.error('Error definitivo insertando inspección en hseq_inspections:', dbErr);
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
