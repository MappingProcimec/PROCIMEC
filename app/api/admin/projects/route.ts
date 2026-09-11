import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createProjectSchema } from '@/lib/validations';
import { createProjectFolder } from '@/lib/drive';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OperationalSummaryRow {
  ml?: number;
  m2?: number;
}

interface FieldReport {
  id: string;
  operational_summary: OperationalSummaryRow[];
  report_date?: string;
  localizador_name?: string;
  operator_name?: string;
  cad_priority?: string;
  status?: string;
  docx_drive_url?: string;
  drive_session_folder_url?: string;
  gpr_equipment?: string;
  positioning_equipment?: string;
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
  contract_number?: string;
  description?: string;
  target_ml?: number;
  target_m2?: number;
  target_metric_type?: 'ml' | 'm2';
  requires_mapping?: boolean;
  requires_positioning?: boolean;
  is_active: boolean;
  created_at: string;
  drive_folder_url?: string;
  field_reports: FieldReport[];
}

export interface TargetMeta {
  target_ml: number;
  target_m2: number;
  target_metric_type: 'ml' | 'm2';
  requires_mapping: boolean;
  requires_positioning: boolean;
}

export function parseProjectTargets(p: Record<string, unknown>): TargetMeta {
  let target_ml = Number(p.target_ml) || 0;
  let target_m2 = Number(p.target_m2) || 0;
  let target_metric_type: 'ml' | 'm2' = (p.target_metric_type as 'ml' | 'm2') || 'ml';
  let requires_mapping = p.requires_mapping !== undefined && p.requires_mapping !== null ? Boolean(p.requires_mapping) : true;
  let requires_positioning = p.requires_positioning !== undefined && p.requires_positioning !== null ? Boolean(p.requires_positioning) : true;

  const desc = String(p.description || '');
  const match = desc.match(/<!--PROJECT_TARGETS:(\{.*?\})-->/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (target_ml === 0 && parsed.target_ml !== undefined) target_ml = Number(parsed.target_ml) || 0;
      if (target_m2 === 0 && parsed.target_m2 !== undefined) target_m2 = Number(parsed.target_m2) || 0;
      if (!p.target_metric_type && parsed.target_metric_type) target_metric_type = parsed.target_metric_type;
      if (p.requires_mapping === undefined && parsed.requires_mapping !== undefined) requires_mapping = Boolean(parsed.requires_mapping);
      if (p.requires_positioning === undefined && parsed.requires_positioning !== undefined) requires_positioning = Boolean(parsed.requires_positioning);
    } catch {}
  }

  return { target_ml, target_m2, target_metric_type, requires_mapping, requires_positioning };
}

export function cleanDescription(desc?: string | null): string {
  if (!desc) return '';
  return desc.replace(/\n?<!--PROJECT_TARGETS:\{.*?\}-->/g, '').trim();
}

export function encodeDescriptionWithTargets(desc: string | null | undefined, targets: TargetMeta): string {
  const base = cleanDescription(desc);
  return `${base}\n<!--PROJECT_TARGETS:${JSON.stringify(targets)}-->`.trim();
}

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let from = 0;
  let allRows: T[] = [];
  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('Error paginando datos:', error);
      break;
    }
    const rows = data ?? [];
    allRows = allRows.concat(rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
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
    .select('*, field_reports(id, operational_summary, report_date, localizador_name, cad_priority, status, docx_drive_url, drive_session_folder_url, gpr_equipment, positioning_equipment)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Actividades de dibujo (recorrer todos los registros sin límite de 1000)
  const activities = await fetchAllRows<DrawingActivity>(async (from, to) => {
    return await supabase
      .from('drawing_activities')
      .select('id, project_name, hours_worked, responsible, activity_date, software, is_rework')
      .range(from, to);
  });

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

    const pRecord = p as unknown as Record<string, unknown>;
    const targets = parseProjectTargets(pRecord);

    let totalML = 0;
    let totalM2 = 0;
    let mappingML = 0;
    let mappingM2 = 0;
    let positioningML = 0;
    let positioningM2 = 0;

    fieldReports.forEach((r) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      const reportML = rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
      const reportM2 = rows.reduce((s, row) => s + (Number(row.m2) || 0), 0);

      totalML += reportML;
      totalM2 += reportM2;

      // Localización subterránea: Si no seleccionó 'Ninguno'
      const eq = (r.gpr_equipment || '').trim();
      const hasMapping = eq.length > 0 && eq.toLowerCase() !== 'ninguno';

      // Posicionamiento: Si no seleccionó 'Sin posicionamiento' ni 'Ninguno'
      const pos = (r.positioning_equipment || '').trim();
      const hasPositioning = pos.length > 0 && pos.toLowerCase() !== 'sin posicionamiento' && pos.toLowerCase() !== 'ninguno';

      if (hasMapping) {
        mappingML += reportML;
        mappingM2 += reportM2;
      }
      if (hasPositioning) {
        positioningML += reportML;
        positioningM2 += reportM2;
      }
    });

    const totalDrawingHours = projectDibujo.reduce(
      (sum, d) => sum + (Number(d.hours_worked) || 0),
      0
    );

    // Cálculo de porcentaje completado hacia el 100%
    const targetValue = targets.target_metric_type === 'm2' ? targets.target_m2 : targets.target_ml;
    const mappingExecuted = targets.target_metric_type === 'm2' ? mappingM2 : mappingML;
    const positioningExecuted = targets.target_metric_type === 'm2' ? positioningM2 : positioningML;

    let mappingProgressPct = 0;
    let positioningProgressPct = 0;
    if (targetValue > 0) {
      mappingProgressPct = Math.min(100, Math.round(((mappingExecuted / targetValue) * 100) * 10) / 10);
      positioningProgressPct = Math.min(100, Math.round(((positioningExecuted / targetValue) * 100) * 10) / 10);
    }

    let overallProgressPct = 0;
    if (targets.requires_mapping && targets.requires_positioning) {
      overallProgressPct = Math.round(((mappingProgressPct + positioningProgressPct) / 2) * 10) / 10;
    } else if (targets.requires_mapping) {
      overallProgressPct = mappingProgressPct;
    } else if (targets.requires_positioning) {
      overallProgressPct = positioningProgressPct;
    } else {
      overallProgressPct = 100;
    }

    const ccVal = String(pRecord.cost_center || pRecord.code || '');
    return {
      id: p.id,
      code: ccVal,
      cost_center: ccVal,
      name: p.name,
      client: p.client,
      location: p.location,
      contract_number: p.contract_number,
      description: cleanDescription(p.description),
      target_ml: targets.target_ml,
      target_m2: targets.target_m2,
      target_metric_type: targets.target_metric_type,
      requires_mapping: targets.requires_mapping,
      requires_positioning: targets.requires_positioning,
      mapping_ml: mappingML,
      mapping_m2: mappingM2,
      positioning_ml: positioningML,
      positioning_m2: positioningM2,
      mapping_progress_pct: mappingProgressPct,
      positioning_progress_pct: positioningProgressPct,
      overall_progress_pct: overallProgressPct,
      is_active: p.is_active,
      created_at: p.created_at,
      drive_folder_url: p.drive_folder_url,
      report_count: fieldReports.length + projectDibujo.length,
      field_reports_count: fieldReports.length,
      drawing_count: projectDibujo.length,
      total_ml: totalML,
      total_m2: totalM2,
      total_drawing_hours: totalDrawingHours,
      field_reports: fieldReports,
      drawing_activities: projectDibujo,
      divisions: divisionsByProject[p.id] ?? [],
    };
  });

  return NextResponse.json(
    { data: resultProjects },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
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

  const {
    cost_center,
    name,
    client,
    location,
    contract_number,
    description,
    target_ml,
    target_m2,
    target_metric_type,
    requires_mapping,
    requires_positioning,
  } = parsed.data;

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
  const targetsMeta: TargetMeta = {
    target_ml: target_ml ?? 0,
    target_m2: target_m2 ?? 0,
    target_metric_type: target_metric_type ?? 'ml',
    requires_mapping: requires_mapping ?? true,
    requires_positioning: requires_positioning ?? true,
  };

  const encodedDescription = encodeDescriptionWithTargets(description, targetsMeta);

  const supabase = createAdminClient();

  const baseInsert: Record<string, unknown> = {
    cost_center: cost_center,
    name: name.toUpperCase().trim(),
    client,
    location,
    contract_number,
    description: encodedDescription,
    target_ml: targetsMeta.target_ml,
    target_m2: targetsMeta.target_m2,
    target_metric_type: targetsMeta.target_metric_type,
    requires_mapping: targetsMeta.requires_mapping,
    requires_positioning: targetsMeta.requires_positioning,
    drive_folder_id: driveFolderId,
    drive_folder_url: driveFolderUrl,
    created_by: session.user.id,
  };

  let { data, error } = await supabase.from('projects').insert(baseInsert).select().single();

  if (error && error.code === '42703') {
    // Si aún no se ha ejecutado la migración 008, guardamos sin las columnas nuevas
    delete baseInsert.target_ml;
    delete baseInsert.target_m2;
    delete baseInsert.target_metric_type;
    delete baseInsert.requires_mapping;
    delete baseInsert.requires_positioning;
    const retry = await supabase.from('projects').insert(baseInsert).select().single();
    data = retry.data;
    error = retry.error;
  }

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

  const targetsMeta: TargetMeta = {
    target_ml: updates.target_ml !== undefined ? Number(updates.target_ml) || 0 : 0,
    target_m2: updates.target_m2 !== undefined ? Number(updates.target_m2) || 0 : 0,
    target_metric_type: updates.target_metric_type || 'ml',
    requires_mapping: updates.requires_mapping !== undefined ? Boolean(updates.requires_mapping) : true,
    requires_positioning: updates.requires_positioning !== undefined ? Boolean(updates.requires_positioning) : true,
  };

  if ('target_ml' in updates || 'target_m2' in updates || 'requires_mapping' in updates || 'requires_positioning' in updates || 'description' in updates) {
    updates.description = encodeDescriptionWithTargets(updates.description, targetsMeta);
  }

  const supabase = createAdminClient();

  if (Object.keys(updates).length > 0) {
    let { error } = await supabase.from('projects').update(updates).eq('id', id);
    if (error && error.code === '42703') {
      const fallback = { ...updates };
      delete fallback.target_ml;
      delete fallback.target_m2;
      delete fallback.target_metric_type;
      delete fallback.requires_mapping;
      delete fallback.requires_positioning;
      const retry = await supabase.from('projects').update(fallback).eq('id', id);
      error = retry.error;
    }
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
