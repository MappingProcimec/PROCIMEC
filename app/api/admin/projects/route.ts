import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createProjectFolder } from '@/lib/drive';
import { createAdminClient } from '@/lib/supabase';
import { createProjectSchema } from '@/lib/validations';

// GET /api/admin/projects
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // 1. Proyectos con sus field_reports
  const { data: dbProjects, error } = await supabase
    .from('projects')
    .select('*, field_reports(id, operational_summary, report_date, operator_name, cad_priority, status, docx_drive_url, drive_session_folder_url)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Actividades de dibujo
  const { data: drawingActivities } = await supabase
    .from('drawing_activities')
    .select('id, project_name, hours_worked, responsible, activity_date, software, is_rework')
    .range(0, 49999);

  const activities = drawingActivities || [];

  // 3. Agrupar actividades por project_name exacto (coincide con projects.name normalizado)
  const drawingByProject = new Map<string, any[]>();
  activities.forEach((a) => {
    const list = drawingByProject.get(a.project_name) || [];
    list.push(a);
    drawingByProject.set(a.project_name, list);
  });

  // 4. Construir respuesta
  const resultProjects = (dbProjects || []).map((p) => {
    const fieldReports = p.field_reports || [];
    const projectDibujo = drawingByProject.get(p.name) || [];

    const totalML = fieldReports.reduce((sum: number, r: any) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      return sum + rows.reduce((s: number, row: any) => s + (Number(row.ml) || 0), 0);
    }, 0);

    const totalDrawingHours = projectDibujo.reduce(
      (sum: number, d: any) => sum + (Number(d.hours_worked) || 0),
      0
    );

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      client: p.client,
      location: p.location,
      is_active: p.is_active,
      created_at: p.created_at,
      drive_folder_url: p.drive_folder_url,
      report_count: fieldReports.length + projectDibujo.length,
      field_reports_count: fieldReports.length,
      drawing_count: projectDibujo.length,
      total_ml: totalML,
      total_drawing_hours: totalDrawingHours,
      field_reports: fieldReports,
      drawing_activities: projectDibujo,
    };
  });

  return NextResponse.json({ data: resultProjects });
}

// POST /api/admin/projects
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { code, name, client, location, contract_number, description } = parsed.data;

  // Crear carpeta en Drive
  let driveFolderId: string | undefined;
  let driveFolderUrl: string | undefined;
  try {
    const folder = await createProjectFolder(code, name);
    driveFolderId = folder.id;
    driveFolderUrl = folder.webViewLink;
  } catch (e) {
    console.error('Drive folder creation failed:', e);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      code,
      name: name.toUpperCase().trim(),
      client,
      location,
      contract_number,
      description,
      drive_folder_id: driveFolderId,
      drive_folder_url: driveFolderUrl,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// PATCH /api/admin/projects
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  if (updates.name) {
    updates.name = updates.name.toUpperCase().trim();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
