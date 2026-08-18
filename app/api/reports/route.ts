import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createProjectFolder, createSessionFolder, uploadFileToDrive } from '@/lib/drive';
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
    // If not admin, check if user is assigned to this project
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
    // Return ALL reports for this project to any authorized user
    query = query.eq('project_id', projectId);
  } else if (session.user.role !== 'admin') {
    // Return all reports for projects assigned to this operator
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

// POST /api/reports — save a new field report + upload files + generate .docx
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['admin', 'operator'].includes(session.user.role || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const formData = await request.formData();

  // Parse JSON fields
  const reportDataRaw = formData.get('reportData') as string;
  if (!reportDataRaw) {
    return NextResponse.json({ error: 'Datos del formulario requeridos' }, { status: 400 });
  }

  const reportData = JSON.parse(reportDataRaw) as {
    project_id: string;
    report_date: string;
    report_time: string;
    report_end_time?: string;
    operator_name: string;
    equipments_used?: string[];
    gpr_equipment?: string;
    positioning_equipment: string;
    terrain_conditions: string;
    weather_conditions?: string;
    capture_method: string;
    operational_summary: unknown[];
    global_max_depth: number | null;

    antenna_frequency?: string;
    rdp_value?: string;
    scans_per_meter?: string;
    rd_data_notes?: string;
    filter_gain_notes?: string;
    detected_utilities: unknown[];
    anomalies_notes?: string;
    site_restrictions?: string;
    cad_priority: 'Alta' | 'Media' | 'Baja';
    processing_recommendations?: string;
  };

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

  // Get user
  const { data: userRecord } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // Ensure Drive folder exists for project (lazy creation if missing)
  let parentDriveFolderId = project.drive_folder_id;
  if (!parentDriveFolderId) {
    try {
      const newFolder = await createProjectFolder(project.code, project.name);
      parentDriveFolderId = newFolder.id;
      // Save back to project record
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
        reportData.operator_name,
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
      operational_summary: reportData.operational_summary,
      global_max_depth: reportData.global_max_depth || null,

      antenna_frequency: reportData.antenna_frequency || null,
      rdp_value: reportData.rdp_value || null,
      scans_per_meter: reportData.scans_per_meter || null,
      rd_data_notes: reportData.rd_data_notes || null,
      filter_gain_notes: reportData.filter_gain_notes || null,

      detected_utilities: reportData.detected_utilities,
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

  // Upload files to Drive and record in DB
  const uploadedFiles: ReportFile[] = [];
  const photoBuffers: { file: ReportFile; buffer: Buffer }[] = [];

  const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file_'));

  for (const [key, value] of fileEntries) {
    if (!(value instanceof File)) continue;

    // key format: file_{fileType}_{index}
    const parts = key.split('_');
    const fileType = parts[1] as 'raw_gpr' | 'gps' | 'photo';
    const captionKey = `caption_${parts[1]}_${parts[2]}`;
    const caption = (formData.get(captionKey) as string) || '';

    const arrayBuffer = await value.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let targetFolderId: string | undefined;
    if (fileType === 'raw_gpr') targetFolderId = rawGprFolderId;
    else if (fileType === 'gps') targetFolderId = gpsFolderId;
    else targetFolderId = photosFolderId;

    let driveFileId: string | undefined;
    let driveWebviewUrl: string | undefined;

    if (targetFolderId) {
      try {
        const driveFile = await uploadFileToDrive(
          targetFolderId,
          buffer,
          value.name,
          value.type || 'application/octet-stream'
        );
        driveFileId = driveFile.id;
        driveWebviewUrl = driveFile.webViewLink;
      } catch (e) {
        console.error(`Error uploading ${value.name}:`, e);
      }
    }

    const { data: savedFile } = await supabase
      .from('report_files')
      .insert({
        field_report_id: fieldReport.id,
        file_type: fileType,
        original_name: value.name,
        drive_file_id: driveFileId || 'pending',
        drive_webview_url: driveWebviewUrl || null,
        caption: caption || null,
        size_bytes: value.size,
        mime_type: value.type,
      })
      .select()
      .single();

    if (savedFile) {
      uploadedFiles.push(savedFile);
      if (fileType === 'photo') {
        photoBuffers.push({ file: savedFile, buffer });
      }
    }
  }

  // Generate .docx
  let docxDriveFileId: string | undefined;
  let docxDriveUrl: string | undefined;

  try {
    const docxBuffer = await generateFieldReportDocx({
      report: fieldReport as unknown as FieldReport,
      project: project as unknown as Project,
      files: uploadedFiles,
      user: userRecord as unknown as AppUser,
      photoBuffers: photoBuffers.slice(0, 4),
    });

    if (sessionFolderId) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const d = new Date();
      const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
      const filename = `Reporte_${project.code}_${dateStr}.docx`;

      const docxDriveFile = await uploadFileToDrive(
        sessionFolderId,
        docxBuffer,
        filename,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      docxDriveFileId = docxDriveFile.id;
      docxDriveUrl = docxDriveFile.webViewLink;
    }

    // Update field report with docx info
    if (docxDriveUrl || docxDriveFileId) {
      await supabase
        .from('field_reports')
        .update({ docx_drive_file_id: docxDriveFileId || null, docx_drive_url: docxDriveUrl || null })
        .eq('id', fieldReport.id);
    }

  } catch (e) {
    console.error('DOCX generation error:', e);
  }

  return NextResponse.json({
    data: {
      fieldReportId: fieldReport.id,
      sessionFolderUrl: sessionFolderUrl || null,
      docxDriveUrl: docxDriveUrl || null,
      docxDriveFileId: docxDriveFileId || null,
    },
  }, { status: 201 });
}
