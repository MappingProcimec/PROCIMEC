import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createProjectFolder } from '@/lib/drive';
import { createAdminClient } from '@/lib/supabase';
import { createProjectSchema } from '@/lib/validations';

/**
 * Normalizador canonico de nombres de proyectos.
 * Agrupa variaciones tipograficas y prefijos ("PROYECTO ", "PRYECTO ", etc.)
 * en un unico nombre estandarizado y limpio.
 */
function normalizeProjectName(rawName: string): string {
  if (!rawName) return 'VARIOS';
  let name = rawName.toUpperCase().trim();

  // Eliminar prefijos repetidos de importaciones manuales
  name = name
    .replace(/^PROYECTO\s+/, '')
    .replace(/^PROEYCTO\s+/, '')
    .replace(/^PRYECTO\s+/, '')
    .replace(/^PROYECYO\s+/, '')
    .replace(/^PROYECT\s+/, '');

  // Limpieza de acentos y caracteres especiales para comparacion de reglas
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\.#_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.includes('MICROTUNEL') || clean.includes('MICRO TUNEL')) return 'MICRO TÚNEL';
  if (clean.includes('COLPATRIA')) return 'CONSTRUCTORA COLPATRIA';
  if (clean.includes('HEINEKEN')) return 'HEINEKEN';
  if (clean.includes('PASEO DEL PARQUE') || clean.includes('PASO DEL PARQUE')) return 'PASEO DEL PARQUE';
  if (clean.includes('AVENIDA CARACAS') || clean.includes('AVENIDAS CARACAS')) return 'AVENIDA CARACAS';
  if (clean.includes('EPM COPACABANA')) return 'EPM COPACABANA';
  if (clean === 'EPM' || clean.includes('EPM')) return 'EPM';
  if (clean.includes('CAJICA ZONA') || clean.includes('CAJICA ZONA2')) return 'CAJICA ZONA 2';
  if (clean.includes('CAJICA')) return 'CAJICA';
  if (clean.includes('YDN COLECTOR NORTE')) return 'YDN COLECTOR NORTE';
  if (clean.includes('YDN COLECTOR BOYACA')) return 'YDN COLECTOR BOYACÁ';
  if (clean.includes('YDN COLECTOR')) return 'YDN COLECTOR';
  if (clean.includes('YDN FINAL')) return 'YDN FINAL';
  if (clean.includes('YDN POLICARPA')) return 'YDN POLICARPA';
  if (clean.includes('YDN')) return 'YDN';
  if (clean.includes('TUNEL DE LA LINEA')) return 'TÚNEL DE LA LÍNEA';
  if (clean.includes('REUNION') || clean.includes('REUNON')) return 'REUNIÓN';
  if (clean.includes('MEGAVIAL')) return 'UT MEGAVIAL ATLÁNTICO';
  if (clean.includes('ARROYOS BAQ')) return 'ARROYOS BAQ LOTE 1';
  if (clean.includes('SIMON BOLIVAR')) return 'COLECTOR SIMÓN BOLÍVAR';
  if (clean.includes('COCA-COLA') || clean.includes('PROCONCIVILES')) return 'PROCONCIVILES (COCA-COLA)';
  if (clean.includes('CANALIZACION') || clean.includes('CANALIZACIÓN')) return 'CANALIZACIÓN 85';
  if (clean.includes('REFINERIA') || clean.includes('BMJA')) return 'REFINERÍA BMJA';
  if (clean.includes('APTO') || clean.includes('BQLLA')) return 'APTO BARRANQUILLA';
  if (clean.includes('AMARILO BGT')) return 'AMARILO BGT';
  if (clean.includes('LOTE FAN AMARILO')) return 'LOTE FAN AMARILO';
  if (clean.includes('QUORA AMARILO')) return 'QUORA AMARILO';
  if (clean.includes('AMARILO')) return 'AMARILO';
  if (clean.includes('FGP')) return 'FGP COLECTORES';
  if (clean.includes('CAUJARAL')) return 'CAUJARAL';
  if (clean.includes('TIERRABOMBA') || clean.includes('TIERRA BOMBA')) return 'TIERRABOMBA';
  if (clean.includes('DIBULLA')) return 'DIBULLA PROMIGAS';
  if (clean.includes('SAN FRANCISCO')) return 'DERECHO SAN FRANCISCO';
  if (clean.includes('TENARIS')) return 'TENARIS';
  if (clean.includes('VOPAK')) return 'VOPAK COLOMBIA BAQ';
  if (clean.includes('CARNAVAL')) return 'CARNAVAL SA';
  if (clean.includes('DIQUES')) return 'INSPECCIÓN DIQUES';
  if (clean.includes('CONINSA')) return 'CONINSA RH VIA 40-72';
  if (clean.includes('SANTA CECILIA') || clean.includes('CANAL MOLINO')) return 'CANAL SANTA CECILIA';
  if (clean.includes('PIMSA')) return 'PIMSA IEB';
  if (clean.includes('CARACOLI')) return 'CARACOLI IEB';
  if (clean.includes('TPF')) return 'CONSORCIO VIAL TPF-CB';

  return name;
}

// GET /api/admin/projects
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // 1. Obtener todas las actividades de dibujo (hasta 50,000 filas)
  const { data: drawingActivities } = await supabase
    .from('drawing_activities')
    .select('id, project_name, hours_worked, responsible, activity_date, software, is_rework')
    .range(0, 49999);

  const activities = drawingActivities || [];

  // 2. Obtener la lista de proyectos en la base de datos
  const { data: dbProjects, error } = await supabase
    .from('projects')
    .select('*, field_reports(id, operational_summary)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3. Normalizar proyectos en la base de datos y eliminar duplicados de la vista
  // Mapa de proyectos canonicos: Key = CanonicalName, Value = Project DB object
  const canonicalProjectsMap = new Map<string, any>();
  const duplicateIdsToDelete: string[] = [];

  (dbProjects || []).forEach((p: any) => {
    const canonicalName = normalizeProjectName(p.name);
    if (!canonicalProjectsMap.has(canonicalName)) {
      canonicalProjectsMap.set(canonicalName, {
        ...p,
        name: canonicalName,
        field_reports: p.field_reports || [],
      });
    } else {
      // Si ya existe el proyecto canonico en la vista, fusionar sus reportes de campo y marcar duplicado
      const existing = canonicalProjectsMap.get(canonicalName);
      existing.field_reports = [...(existing.field_reports || []), ...(p.field_reports || [])];
      duplicateIdsToDelete.push(p.id);
    }
  });

  // Limpiar duplicados redundantes creados anteriormente en la tabla `projects`
  if (duplicateIdsToDelete.length > 0) {
    supabase.from('projects').delete().in('id', duplicateIdsToDelete).then(() => {});
  }

  // 4. Asegurar que cada nombre canonico presente en `drawing_activities` tenga un proyecto unico
  const drawingCanonicalNames = new Set(
    activities.map((a) => normalizeProjectName(a.project_name)).filter(Boolean)
  );

  const newProjectsToCreate: any[] = [];
  let index = canonicalProjectsMap.size + 1;

  drawingCanonicalNames.forEach((cName) => {
    if (!canonicalProjectsMap.has(cName)) {
      const newProj = {
        code: `PRJ-${String(index++).padStart(3, '0')}`,
        name: cName,
        client: cName,
        location: 'Varias',
        is_active: true,
        created_by: session.user.id,
      };
      canonicalProjectsMap.set(cName, {
        ...newProj,
        id: `temp-${cName}`,
        field_reports: [],
      });
      newProjectsToCreate.push(newProj);
    }
  });

  if (newProjectsToCreate.length > 0) {
    supabase.from('projects').insert(newProjectsToCreate).then(() => {});
  }

  // 5. Agrupar las actividades de dibujo por nombre canonico
  const drawingByCanonical = new Map<string, any[]>();
  activities.forEach((a) => {
    const cName = normalizeProjectName(a.project_name);
    const list = drawingByCanonical.get(cName) || [];
    list.push(a);
    drawingByCanonical.set(cName, list);
  });

  // 6. Construir lista final unificada y limpia de proyectos
  const resultProjects = Array.from(canonicalProjectsMap.values()).map((p) => {
    const fieldReports = p.field_reports || [];
    const totalML = fieldReports.reduce((sum: number, r: { operational_summary?: { ml?: number }[] }) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      return sum + rows.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
    }, 0);

    const projectDibujo = drawingByCanonical.get(p.name) || [];
    const totalDrawingHours = projectDibujo.reduce((sum, d) => sum + (Number(d.hours_worked) || 0), 0);

    return {
      id: p.id,
      code: p.code || 'PRJ-000',
      name: p.name,
      client: p.client || p.name,
      location: p.location || 'Varias',
      is_active: p.is_active !== false,
      created_at: p.created_at || new Date().toISOString(),
      report_count: fieldReports.length + projectDibujo.length,
      field_reports_count: fieldReports.length,
      drawing_count: projectDibujo.length,
      total_ml: totalML,
      total_drawing_hours: totalDrawingHours,
      field_reports: fieldReports,
      drawing_activities: projectDibujo,
    };
  });

  // Ordenar alfabeticamente por nombre canonico
  resultProjects.sort((a, b) => a.name.localeCompare(b.name, 'es'));

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
      name: normalizeProjectName(name),
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
    updates.name = normalizeProjectName(updates.name);
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
