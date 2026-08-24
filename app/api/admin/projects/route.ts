import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createProjectFolder } from '@/lib/drive';
import { createAdminClient } from '@/lib/supabase';
import { createProjectSchema } from '@/lib/validations';

const DEFAULT_PROJECTS = [
  { code: 'TENARIS-01', name: 'TENARIS', client: 'TENARIS', location: 'Cartagena' },
  { code: 'VOPAK-01', name: 'VOPAK COLOMBIA BAQ', client: 'VOPAK', location: 'Barranquilla' },
  { code: 'CARNAVAL-01', name: 'CARNAVAL SA', client: 'CARNAVAL SA', location: 'Soledad' },
  { code: 'EPM-01', name: 'EPM COPACABANA', client: 'EPM', location: 'Copacabana' },
  { code: 'DIQUES-01', name: 'INSPECCION DIQUES', client: 'MAPPING', location: 'Varias' },
  { code: 'CANAL-01', name: 'CANAL SANTA CECILIA', client: 'MAPPING', location: 'Barranquilla' },
  { code: 'CONINSA-01', name: 'CONINSA RH VIA 40-72', client: 'CONINSA RH', location: 'Barranquilla' },
  { code: 'AMARILO-01', name: 'LOTE FAN AMARILO', client: 'AMARILO', location: 'Barranquilla' },
  { code: 'YDN-01', name: 'YDN POLICARPA', client: 'YDN', location: 'Bogotá' },
  { code: 'YDN-02', name: 'YDN COLECTOR BOYACA', client: 'YDN', location: 'Bogotá' },
  { code: 'PIMSA-01', name: 'PIMSA IEB', client: 'IEB', location: 'Malambo' },
  { code: 'CARACOLI-01', name: 'CARACOLI IEB', client: 'IEB', location: 'Malambo' },
  { code: 'TPF-01', name: 'CONSORCIO VIAL TPF-CB PUENTES', client: 'TPF-CB', location: 'Atlántico' },
  { code: 'AMARILO-02', name: 'QUORA AMARILO', client: 'AMARILO', location: 'Barranquilla' },
  { code: 'COLECTOR-01', name: 'COLECTOR SIMON BOLIVAR', client: 'TRIPLE A', location: 'Barranquilla' },
  { code: 'COLPATRIA-01', name: 'CONSTRUTORA COLPATRIA', client: 'COLPATRIA', location: 'Barranquilla' },
  { code: 'DESARROLLO-01', name: 'DESARROLLO', client: 'MAPPING', location: 'Interno' },
];

function matchesProject(activityProjectName: string, projectName: string): boolean {
  if (!activityProjectName || !projectName) return false;
  const a = activityProjectName.toUpperCase().trim().replace(/CONSTRUCTORA/g, 'CONSTRUTORA');
  const p = projectName.toUpperCase().trim().replace(/CONSTRUCTORA/g, 'CONSTRUTORA');

  if (a === p) return true;
  if (a.length >= 3 && p.length >= 3) {
    if (a.startsWith(p) || p.startsWith(a)) return true;
    if (a.includes(p) || p.includes(a)) return true;
  }
  return false;
}

// GET /api/admin/projects
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // 1. Consultar proyectos de la tabla projects
  const { data: initialData, error } = await supabase
    .from('projects')
    .select('*, field_reports(id, operational_summary)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let data = initialData || [];

  // Si hay pocos proyectos, sembrar los predeterminados
  if (data.length <= 2) {
    const existingNames = new Set(data.map((p: { name: string }) => p.name.toUpperCase()));
    const toInsert = DEFAULT_PROJECTS.filter((p) => !existingNames.has(p.name.toUpperCase())).map((p) => ({
      ...p,
      is_active: true,
      created_by: session.user.id,
    }));

    if (toInsert.length > 0) {
      await supabase.from('projects').insert(toInsert);
      const res = await supabase
        .from('projects')
        .select('*, field_reports(id, operational_summary)')
        .order('created_at', { ascending: false });
      data = res.data || data;
    }
  }

  // 2. Consultar actividades de dibujo con rango amplio
  const { data: drawingActivities } = await supabase
    .from('drawing_activities')
    .select('id, project_name, hours_worked, responsible, activity_date, software, is_rework')
    .range(0, 49999);

  const activities = drawingActivities || [];

  // 3. Extraer proyectos únicos presentes en drawing_activities y auto-crear los que falten en `projects`
  const uniqueDrawingProjects = Array.from(
    new Set(activities.map((a) => (a.project_name || '').trim()).filter(Boolean))
  );

  const currentNames = data.map((p: { name: string }) => (p.name || '').toUpperCase().trim());

  const missingDrawingProjects = uniqueDrawingProjects.filter(
    (dName) => !currentNames.some((cName) => matchesProject(dName, cName))
  );

  if (missingDrawingProjects.length > 0) {
    const newProjectsToInsert = missingDrawingProjects.map((dName, idx) => ({
      code: `DIB-${String(idx + 1).padStart(3, '0')}`,
      name: dName,
      client: dName,
      location: 'Varias',
      is_active: true,
      created_by: session.user.id,
    }));

    await supabase.from('projects').insert(newProjectsToInsert);
    const refreshed = await supabase
      .from('projects')
      .select('*, field_reports(id, operational_summary)')
      .order('created_at', { ascending: false });
    data = refreshed.data || data;
  }

  // 4. Calcular metricas exactas por proyecto (Campo + Dibujo)
  const projects = data.map((p: { name: string; field_reports?: { id: string; operational_summary: { ml?: number }[] }[]; [key: string]: unknown }) => {
    const fieldReports = p.field_reports || [];
    const totalML = fieldReports.reduce((sum: number, r: { operational_summary?: { ml?: number }[] }) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      return sum + rows.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
    }, 0);

    const projectDibujo = activities.filter((a) => matchesProject(a.project_name, p.name));
    const totalDrawingHours = projectDibujo.reduce((sum, d) => sum + (Number(d.hours_worked) || 0), 0);

    return {
      ...p,
      report_count: fieldReports.length + projectDibujo.length,
      field_reports_count: fieldReports.length,
      drawing_count: projectDibujo.length,
      total_ml: totalML,
      total_drawing_hours: totalDrawingHours,
      field_reports: fieldReports,
      drawing_activities: projectDibujo,
    };
  });

  return NextResponse.json({ data: projects });
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

  // Create Drive folder
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
      name,
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
