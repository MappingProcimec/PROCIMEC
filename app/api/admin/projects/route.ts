import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createProjectFolder } from '@/lib/drive';
import { createAdminClient } from '@/lib/supabase';
import { createProjectSchema } from '@/lib/validations';

interface OperationalSummaryRow {
  ml?: number;
}

interface FieldReport {
  id: string;
  operational_summary: OperationalSummaryRow[];
  report_date?: string;
  operator_name?: string;
  cad_priority?: string;
  status?: string;
  docx_drive_url?: string;
  drive_session_folder_url?: string;
}

interface DrawingActivity {
  id: string;
  project_name: string;
  hours_worked: number;
  responsible: string;
  activity_date: string;
  software: string;
  is_rework: boolean;
}

interface DbProject {
  id: string;
  code?: string;
  cost_center?: string;
  name: string;
  client: string;
  location: string;
  is_active: boolean;
  created_at: string;
  drive_folder_url?: string;
  field_reports: FieldReport[];
}

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

  const activities: DrawingActivity[] = drawingActivities || [];

  // 3. Agrupar actividades por project_name exacto
  const drawingByProject = new Map<string, DrawingActivity[]>();
  activities.forEach((a) => {
    const list = drawingByProject.get(a.project_name) || [];
    list.push(a);
    drawingByProject.set(a.project_name, list);
  });

  // 4. Divisiones por proyecto
  type DivisionRow = { project_id: string; divisions: { id: string; name: string } | null };
  const { data: dpData } = await supabase
    .from('division_projects')
    .select('project_id, divisions(id, name)');
  const divisionsByProject: Record<string, { id: string; name: string }[]> = {};
  ((dpData as unknown as DivisionRow[]) ?? []).forEach((row) => {
    if (!row.divisions) return;
    if (!divisionsByProject[row.project_id]) divisionsByProject[row.project_id] = [];
    divisionsByProject[row.project_id].push(row.divisions);
  });

  // 5. Construir respuesta
  const resultProjects = (dbProjects as DbProject[] || []).map((p) => {
    const fieldReports: FieldReport[] = p.field_reports || [];
    const projectDibujo: DrawingActivity[] = drawingByProject.get(p.name) || [];

    const totalML = fieldReports.reduce((sum, r) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      return sum + rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
    }, 0);

    const totalDrawingHours = projectDibujo.reduce(
      (sum, d) => sum + (Number(d.hours_worked) || 0),
      0
    );

    const pRecord = p as unknown as Record<string, unknown>;
    const ccVal = String(pRecord.cost_center || pRecord.code || '');
    return {
      id: p.id,
      code: ccVal,
      cost_center: ccVal,
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
      divisions: divisionsByProject[p.id] ?? [],
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

  const { cost_center, name, client, location, contract_number, description } = parsed.data;

  // Crear carpeta en Drive
  let driveFolderId: string | undefined;
  let driveFolderUrl: string | undefined;
  try {
    const folder = await createProjectFolder(cost_center, name);
    driveFolderId = folder.id;
    driveFolderUrl = folder.webViewLink;
  } catch (e) {
    console.error('Drive folder creation failed:', e);
  }

  const divisionIds: string[] = body.division_ids ?? [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      cost_center: cost_center,
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

  if (divisionIds.length > 0) {
    await supabase
      .from('division_projects')
      .insert(divisionIds.map((did) => ({ division_id: did, project_id: data.id })));
  }

  return NextResponse.json({ data }, { status: 201 });
}

// PATCH /api/admin/projects
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, division_ids, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  if (updates.code && !updates.cost_center) {
    updates.cost_center = updates.code;
  }
  delete updates.code;

  if (updates.name) {
    updates.name = updates.name.toUpperCase().trim();
  }

  const supabase = createAdminClient();

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(division_ids)) {
    await supabase.from('division_projects').delete().eq('project_id', id);
    if (division_ids.length > 0) {
      await supabase
        .from('division_projects')
        .insert(division_ids.map((did: string) => ({ division_id: did, project_id: id })));
    }
  }

  const { data: updated, error: fetchErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  return NextResponse.json({ data: updated });
}
