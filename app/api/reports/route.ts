import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createProjectFolder, createSessionFolder, setFilePublicPermission, uploadFileToDrive } from '@/lib/drive';
import { generateFieldReportDocx } from '@/lib/docx-generator';
import { FieldReport, Project, ReportFile, AppUser } from '@/types';

// GET /api/reports — list reports for assigned project or user
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  let query = supabase
    .from('field_reports')
    .select('*, projects(code, name, client), users(full_name)')
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

// POST /api/reports — Create field report record + create Drive session folders
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'operator'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const reportData = body.reportData || body;

    if (!reportData || !reportData.project_id) {
      return NextResponse.json({ error: 'Datos del reporte incompletos' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get project
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', reportData.project_id)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Ensure Drive folder exists for project (lazy creation if missing)
    let parentDriveFolderId = project.drive_folder_id;
    if (!parentDriveFolderId) {
      try {
        const newFolder = await createProjectFolder(project.code, project.name);
        parentDriveFolderId = newFolder.id;
        await supabase
          .from('projects')
          .update({ drive_folder_id: newFolder.id, drive_folder_url: newFolder.webViewLink })
          .eq('id', project.id);
      } catch (e) {
        console.error('Lazy Drive project folder creation error:', e);
      }
    }

    // Create Drive session folder
    let sessionFolderId: string | undefined;
    let sessionFolderUrl: string | undefined;
    let rawGprFolderId: string | undefined;
    let gpsFolderId: string | undefined;
    let photosFolderId: string | undefined;

    if (parentDriveFolderId) {
      try {
        const { sessionFolder, rawGprFolder, gpsFolder, photosFolder } = await createSessionFolder(
          parentDriveFolderId,
          reportData.operator_name || session.user.name || 'Operador',
          new Date()
        );
        sessionFolderId = sessionFolder.id;
        sessionFolderUrl = sessionFolder.webViewLink;
        rawGprFolderId = rawGprFolder.id;
        gpsFolderId = gpsFolder.id;
        photosFolderId = photosFolder.id;
      } catch (e) {
        console.error('Drive session folder creation error:', e);
      }
    }

    // Insert field report
    const { data: fieldReport, error: reportError } = await supabase
      .from('field_reports')
      .insert({
        project_id: reportData.project_id,
        created_by: session.user.id,
        report_date: reportData.report_date,
        report_time: reportData.report_time || null,
        report_end_time: reportData.report_end_time || null,
        operator_name: reportData.operator_name,
        equipments_used: reportData.equipments_used || [],
        gpr_equipment: reportData.gpr_equipment || (reportData.equipments_used ? reportData.equipments_used.join(', ') : 'GPR'),
        positioning_equipment: reportData.positioning_equipment,
        terrain_conditions: reportData.terrain_conditions,
        weather_conditions: reportData.weather_conditions || null,
        capture_method: reportData.capture_method,
        operational_summary: reportData.operational_summary || [],
        global_max_depth: reportData.global_max_depth || null,

        antenna_frequency: reportData.antenna_frequency || null,
        rdp_value: reportData.rdp_value || null,
        scans_per_meter: reportData.scans_per_meter || null,
        rd_data_notes: reportData.rd_data_notes || null,
        filter_gain_notes: reportData.filter_gain_notes || null,

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
      return NextResponse.json({ error: reportError?.message || 'Error al guardar el reporte' }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        fieldReportId: fieldReport.id,
        sessionFolderId,
        sessionFolderUrl,
        rawGprFolderId,
        gpsFolderId,
        photosFolderId,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/reports error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al guardar reporte' }, { status: 500 });
  }
}

// PUT /api/reports — Record file or finalize docx report
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'operator'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, fieldReportId, fileType, originalName, driveFileId, caption, sizeBytes, mimeType } = body;

    const supabase = createAdminClient();

    if (action === 'add_file') {
      if (!fieldReportId || !driveFileId || !originalName) {
        return NextResponse.json({ error: 'Faltan parámetros del archivo' }, { status: 400 });
      }

      // Set public link permission in Drive
      let webViewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
      if (driveFileId !== 'pending') {
        const permResult = await setFilePublicPermission(driveFileId);
        if (permResult.webViewLink) webViewUrl = permResult.webViewLink;
      }

      const { data: savedFile, error: fileErr } = await supabase
        .from('report_files')
        .insert({
          field_report_id: fieldReportId,
          file_type: fileType,
          original_name: originalName,
          drive_file_id: driveFileId,
          drive_webview_url: webViewUrl,
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

    if (action === 'finalize') {
      if (!fieldReportId) {
        return NextResponse.json({ error: 'ID de reporte requerido' }, { status: 400 });
      }

      // Fetch complete report
      const { data: fieldReport } = await supabase
        .from('field_reports')
        .select('*')
        .eq('id', fieldReportId)
        .single();

      if (!fieldReport) {
        return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
      }

      // Fetch project
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', fieldReport.project_id)
        .single();

      // Fetch uploaded files
      const { data: files = [] } = await supabase
        .from('report_files')
        .select('*')
        .eq('field_report_id', fieldReportId);

      // Fetch user
      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // Generate .docx
      let docxDriveFileId: string | undefined;
      let docxDriveUrl: string | undefined;

      try {
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
          const filename = `Reporte_${project.code}_${dateStr}.docx`;

          const docxDriveFile = await uploadFileToDrive(
            fieldReport.drive_session_folder_id,
            docxBuffer,
            filename,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          docxDriveFileId = docxDriveFile.id;
          docxDriveUrl = docxDriveFile.webViewLink;
        }

        if (docxDriveUrl || docxDriveFileId) {
          await supabase
            .from('field_reports')
            .update({ docx_drive_file_id: docxDriveFileId || null, docx_drive_url: docxDriveUrl || null })
            .eq('id', fieldReportId);
        }
      } catch (e) {
        console.error('DOCX generation error during finalize:', e);
      }

      return NextResponse.json({
        data: {
          fieldReportId,
          sessionFolderUrl: fieldReport.drive_session_folder_url,
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
