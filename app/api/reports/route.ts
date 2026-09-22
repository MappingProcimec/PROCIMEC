import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createProjectFolder, createSessionFolder, setFilePublicPermission, uploadFileToDrive } from '@/lib/drive';
import { generateFieldReportDocx } from '@/lib/docx-generator';
import { FieldReport, Project, ReportFile, AppUser } from '@/types';
import { generateGprExecutiveSummary, ProjectContext, GprReportContext } from '@/lib/gpr/geminiGprSummary';
import { generateGprDailyPdf, ReportPhoto } from '@/lib/gpr/gprDailyPdfGenerator';

export const dynamic = 'force-dynamic';

// GET /api/reports — list reports for assigned project or user
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  let query = supabase
    .from('field_reports')
    .select('*, projects(cost_center, name, client, location, code), users(full_name)')
    .order('created_at', { ascending: false });

  if (projectId) {
    if (session.user.role !== 'admin') {
      const { data: assignment } = await supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', session.user.id)
        .eq('project_id', projectId)
        .maybeSingle();

      if (!assignment) {
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 });
      }
    }
    query = query.eq('project_id', projectId);
  } else if (session.user.role !== 'admin') {
    const { data: userProjects } = await supabase
      .from('user_projects')
      .select('project_id')
      .eq('user_id', session.user.id);

    const projectIds = (userProjects || []).map((p: { project_id: string }) => p.project_id);
    if (projectIds.length === 0) return NextResponse.json({ data: [] });
    query = query.in('project_id', projectIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/reports — Create field report record (Supabase Primary + Optional Drive)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'localizador', 'operator', 'dibujo'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const reportData = body.reportData || body;

    if (!reportData || !reportData.project_id) {
      return NextResponse.json({ error: 'Datos del reporte incompletos' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener proyecto canónico de la base de datos
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', reportData.project_id)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // 2. Intentar crear o vincular carpetas en Google Drive (Tolerante a fallos / No bloqueante)
    let parentDriveFolderId = project.drive_folder_id;
    let sessionFolderId: string | undefined;
    let sessionFolderUrl: string | undefined;
    let rawGprFolderId: string | undefined;
    let gpsFolderId: string | undefined;
    let photosFolderId: string | undefined;

    if (!parentDriveFolderId) {
      try {
        const newFolder = await createProjectFolder(project.cost_center || project.code, project.name);
        parentDriveFolderId = newFolder.id;
        await supabase
          .from('projects')
          .update({ drive_folder_id: newFolder.id, drive_folder_url: newFolder.webViewLink })
          .eq('id', project.id);
      } catch (driveErr) {
        console.warn('Aviso: Creación de carpeta de proyecto en Google Drive omitida (Drive no configurado o token expirado):', driveErr);
      }
    }

    if (parentDriveFolderId) {
      try {
        const { sessionFolder, rawGprFolder, gpsFolder, photosFolder } = await createSessionFolder(
          parentDriveFolderId,
          reportData.localizador_name || reportData.operator_name || session.user.name || 'Localizador',
          new Date()
        );
        sessionFolderId = sessionFolder.id;
        sessionFolderUrl = sessionFolder.webViewLink;
        rawGprFolderId = rawGprFolder.id;
        gpsFolderId = gpsFolder.id;
        photosFolderId = photosFolder.id;
      } catch (driveErr) {
        console.warn('Aviso: Creación de subcarpetas en Google Drive omitida:', driveErr);
      }
    }

    // 3. Formatear campos para la base de datos
    const formattedEquipments = reportData.equipments_used && reportData.equipments_used.length > 0
      ? reportData.equipments_used.join(', ')
      : (reportData.gpr_equipment || 'GPR');

    const formattedTime = reportData.report_time
      ? (reportData.report_end_time ? `${reportData.report_time} - ${reportData.report_end_time}` : reportData.report_time)
      : null;

    const formattedFrequency = [
      reportData.antenna_frequency,
      reportData.rdp_value ? `RDP: ${reportData.rdp_value}` : '',
      reportData.scans_per_meter ? `Trazas/m: ${reportData.scans_per_meter}` : '',
    ].filter(Boolean).join(' | ') || null;

    const formattedFilterGain = [
      reportData.filter_gain_notes,
      reportData.rd_data_notes ? `Config RD: ${reportData.rd_data_notes}` : '',
    ].filter(Boolean).join(' | ') || null;

    // 4. Inserción directa en tabla field_reports de Supabase
    const { data: fieldReport, error: reportError } = await supabase
      .from('field_reports')
      .insert({
        project_id: reportData.project_id,
        created_by: session.user.id,
        report_date: reportData.report_date,
        report_time: formattedTime,
        localizador_name: reportData.localizador_name || reportData.operator_name || session.user.name,
        gpr_equipment: formattedEquipments,
        positioning_equipment: reportData.positioning_equipment,
        terrain_conditions: reportData.terrain_conditions,
        weather_conditions: reportData.weather_conditions || null,
        capture_method: reportData.capture_method,
        operational_summary: reportData.operational_summary || [],
        global_max_depth: reportData.global_max_depth || null,

        antenna_frequency: formattedFrequency,
        filter_gain_notes: formattedFilterGain,

        detected_utilities: reportData.detected_utilities || [],
        anomalies_notes: reportData.anomalies_notes || null,
        site_restrictions: reportData.site_restrictions || null,
        cad_priority: reportData.cad_priority,
        processing_recommendations: reportData.processing_recommendations || null,

        drive_session_folder_id: sessionFolderId || null,
        drive_session_folder_url: sessionFolderUrl || null,
        status: 'submitted',
      })
      .select()
      .single();

    if (reportError || !fieldReport) {
      console.error('Error insertando field_report en Supabase:', reportError);
      return NextResponse.json({ error: reportError?.message || 'Error al guardar el reporte en la base de datos' }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        fieldReportId: fieldReport.id,
        sessionFolderId: sessionFolderId || null,
        sessionFolderUrl: sessionFolderUrl || null,
        rawGprFolderId: rawGprFolderId || null,
        gpsFolderId: gpsFolderId || null,
        photosFolderId: photosFolderId || null,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/reports error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al guardar reporte' }, { status: 500 });
  }
}

// PUT /api/reports — Registrar archivo o Finalizar reporte (Generación PDF con IA)
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'localizador', 'operator', 'dibujo'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      action,
      fieldReportId,
      fileType,
      originalName,
      driveFileId,
      storagePath,
      storageUrl,
      caption,
      sizeBytes,
      mimeType,
    } = body;

    const supabase = createAdminClient();

    // ─────────────────────────────────────────────────────────────────────────
    // ACCIÓN: add_file (Registro en base de datos)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'add_file') {
      if (!fieldReportId || (!driveFileId && !storageUrl) || !originalName) {
        return NextResponse.json({ error: 'Faltan parámetros del archivo' }, { status: 400 });
      }

      let webViewUrl = storageUrl || '';
      if (driveFileId && driveFileId !== 'pending' && driveFileId !== 'supabase_storage') {
        try {
          const permResult = await setFilePublicPermission(driveFileId);
          if (permResult.webViewLink) webViewUrl = permResult.webViewLink;
        } catch {
          webViewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
        }
      }

      const { data: savedFile, error: fileErr } = await supabase
        .from('report_files')
        .insert({
          field_report_id: fieldReportId,
          file_type: fileType,
          original_name: originalName,
          drive_file_id: driveFileId || 'supabase_storage',
          drive_webview_url: webViewUrl,
          storage_path: storagePath || null,
          storage_url: storageUrl || null,
          caption: caption || null,
          size_bytes: sizeBytes || 0,
          mime_type: mimeType || null,
        })
        .select()
        .single();

      if (fileErr) {
        return NextResponse.json({ error: fileErr.message }, { status: 500 });
      }

      return NextResponse.json({ data: savedFile });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACCIÓN: finalize (Generación de Reporte Corto en PDF con Google Gemini AI)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'finalize') {
      if (!fieldReportId) {
        return NextResponse.json({ error: 'ID de reporte requerido' }, { status: 400 });
      }

      // 1. Consultar reporte completo
      const { data: fieldReport, error: repErr } = await supabase
        .from('field_reports')
        .select('*')
        .eq('id', fieldReportId)
        .single();

      if (repErr || !fieldReport) {
        return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
      }

      // 2. Consultar proyecto obligatorio (El reporte debe tener en cuenta el proyecto)
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', fieldReport.project_id)
        .single();

      if (projErr || !project) {
        return NextResponse.json({ error: 'Proyecto asociado no encontrado' }, { status: 404 });
      }

      // 3. Consultar archivos de evidencias fotográficas adjuntas
      const { data: files = [] } = await supabase
        .from('report_files')
        .select('*')
        .eq('field_report_id', fieldReportId);

      // Contexto del proyecto y reporte para la IA y el PDF
      const projectContext: ProjectContext = {
        id: project.id,
        name: project.name,
        client: project.client,
        code: project.code,
        location: project.location,
        cost_center: project.cost_center,
      };

      const reportContext: GprReportContext = {
        report_date: fieldReport.report_date,
        report_time: fieldReport.report_time,
        localizador_name: fieldReport.localizador_name || 'Localizador',
        gpr_equipment: fieldReport.gpr_equipment,
        antenna_frequency: fieldReport.antenna_frequency,
        positioning_equipment: fieldReport.positioning_equipment,
        terrain_conditions: fieldReport.terrain_conditions,
        weather_conditions: fieldReport.weather_conditions,
        capture_method: fieldReport.capture_method,
        operational_summary: fieldReport.operational_summary || [],
        global_max_depth: fieldReport.global_max_depth,
        detected_utilities: fieldReport.detected_utilities || [],
        anomalies_notes: fieldReport.anomalies_notes,
        site_restrictions: fieldReport.site_restrictions,
        cad_priority: fieldReport.cad_priority,
        processing_recommendations: fieldReport.processing_recommendations,
      };

      // 4. Preparar fotos de campo (descargando de Supabase Storage para embeber en base64 en el PDF)
      const photoFiles = (files || []).filter((f: ReportFile) => f.file_type === 'photo');
      const preparedPhotos: ReportPhoto[] = [];

      for (const pf of photoFiles) {
        try {
          if (pf.storage_path) {
            const { data: fileBlob } = await supabase.storage
              .from('evidencias')
              .download(pf.storage_path);

            if (fileBlob) {
              const arrayBuffer = await fileBlob.arrayBuffer();
              const b64 = Buffer.from(arrayBuffer).toString('base64');
              const mime = pf.mime_type || 'image/jpeg';
              preparedPhotos.push({
                original_name: pf.original_name,
                caption: pf.caption,
                base64: `data:${mime};base64,${b64}`,
                storage_url: pf.storage_url,
              });
            }
          }
        } catch (photoErr) {
          console.warn(`No se pudo procesar foto ${pf.original_name} para el PDF:`, photoErr);
        }
      }

      // 5. Síntesis Técnica Ejecutiva con Google Gemini AI (o fallback inteligente)
      let aiSummary = '';
      try {
        aiSummary = await generateGprExecutiveSummary(projectContext, reportContext);
      } catch (aiErr) {
        console.warn('Aviso en generación de síntesis con Gemini:', aiErr);
        aiSummary = `Operación de georadar en el proyecto ${project.name} para ${project.client}. Exploración ejecutada por ${fieldReport.localizador_name} con registro fotográfico y volumétrico oficial consolidado en base de datos.`;
      }

      // 6. Generación del Reporte Corto Diario en PDF con jsPDF
      const { fileName: pdfFileName, pdfBuffer } = await generateGprDailyPdf({
        project: projectContext,
        report: reportContext,
        aiSummary,
        photos: preparedPhotos,
      });

      // 7. Subir el PDF generado a Supabase Storage (Bucket 'evidencias')
      const pdfStoragePath = `field-reports/${fieldReportId}/reportes/${Date.now()}_${pdfFileName}`;
      const { error: pdfUploadErr } = await supabase.storage
        .from('evidencias')
        .upload(pdfStoragePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      let pdfReportUrl = '';
      if (!pdfUploadErr) {
        const { data: pdfUrlData } = supabase.storage
          .from('evidencias')
          .getPublicUrl(pdfStoragePath);
        pdfReportUrl = pdfUrlData?.publicUrl || '';
      } else {
        console.error('Error subiendo PDF a Supabase Storage:', pdfUploadErr);
      }

      // 8. Opcional: Generar .docx y subir a Drive si Drive está configurado (sin bloquear si falla)
      let docxDriveFileId: string | undefined;
      let docxDriveUrl: string | undefined;

      try {
        const { data: userRecord } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const docxBuffer = await generateFieldReportDocx({
          report: fieldReport as unknown as FieldReport,
          project: project as unknown as Project,
          files: (files || []) as unknown as ReportFile[],
          user: userRecord as unknown as AppUser,
        });

        if (fieldReport.drive_session_folder_id) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const d = new Date();
          const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
          const pCode = project.cost_center || project.code || 'PROJ';
          const filename = `Reporte_${pCode}_${dateStr}.docx`;

          const docxDriveFile = await uploadFileToDrive(
            fieldReport.drive_session_folder_id,
            docxBuffer,
            filename,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          docxDriveFileId = docxDriveFile.id;
          docxDriveUrl = docxDriveFile.webViewLink;
        }
      } catch (docxErr) {
        console.warn('Aviso: Generación de .docx en Drive omitida (Drive no disponible):', docxErr);
      }

      // 9. Actualizar field_reports con la URL del PDF, la ruta de storage y la síntesis de IA
      await supabase
        .from('field_reports')
        .update({
          pdf_report_url: pdfReportUrl || null,
          pdf_storage_path: pdfStoragePath || null,
          ai_summary: aiSummary,
          docx_drive_file_id: docxDriveFileId || fieldReport.docx_drive_file_id || null,
          docx_drive_url: docxDriveUrl || fieldReport.docx_drive_url || null,
          status: 'submitted',
        })
        .eq('id', fieldReportId);

      return NextResponse.json({
        data: {
          fieldReportId,
          pdfReportUrl,
          aiSummary,
          projectName: project.name,
          clientName: project.client,
          sessionFolderUrl: fieldReport.drive_session_folder_url || null,
          docxDriveUrl: docxDriveUrl || fieldReport.docx_drive_url || null,
        },
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (err) {
    console.error('PUT /api/reports error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al procesar la solicitud' }, { status: 500 });
  }
}
