import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // 1. División básica
  const { data: division, error: divErr } = await supabase
    .from('divisions')
    .select('id, name, description, created_at')
    .eq('id', id)
    .single();

  if (divErr || !division) {
    return NextResponse.json({ error: divErr?.message ?? 'Not found' }, { status: 404 });
  }

  // 2. Roles con conteo de tools y forms
  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, name, is_system_role, role_tools(tool_id), role_forms(form_id)')
    .eq('division_id', id)
    .order('name', { ascending: true });

  type RawRoleFull = {
    id: string; name: string; is_system_role: boolean;
    role_tools: { tool_id: string }[]; role_forms: { form_id: string }[];
  };
  const rolesTyped = (rolesRaw as unknown as RawRoleFull[]) ?? [];
  const roleIds = rolesTyped.map((r) => r.id);

  // 3. Usuarios asignados a los roles de esta división
  type UserRow = { id: string; full_name: string; email: string; role_id: string; roles: { name: string } | null };
  let usersRaw: UserRow[] = [];
  if (roleIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role_id, roles(name)')
      .in('role_id', roleIds)
      .order('full_name', { ascending: true });
    usersRaw = (data as unknown as UserRow[]) ?? [];
  }

  const userIds = usersRaw.map(u => u.id);

  const userCountByRole: Record<string, number> = {};
  usersRaw.forEach((u) => {
    if (u.role_id) userCountByRole[u.role_id] = (userCountByRole[u.role_id] ?? 0) + 1;
  });

  const roles = rolesTyped.map((r) => ({
    id: r.id,
    name: r.name,
    is_system_role: r.is_system_role,
    tool_count: r.role_tools?.length ?? 0,
    form_count: r.role_forms?.length ?? 0,
    user_count: userCountByRole[r.id] ?? 0,
  }));

  const users = usersRaw.map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role_name: u.roles?.name ?? '—',
  }));

  // 4. Proyectos conectados a la división (relación directa, roles o usuarios)
  const projectIdsSet = new Set<string>();

  // a) Directamente desde division_projects
  const { data: dpData } = await supabase
    .from('division_projects')
    .select('project_id')
    .eq('division_id', id);
  ((dpData ?? []) as { project_id: string }[]).forEach(r => { if (r.project_id) projectIdsSet.add(r.project_id); });

  // b) Desde role_projects
  if (roleIds.length > 0) {
    const { data: rpData } = await supabase
      .from('role_projects')
      .select('project_id')
      .in('role_id', roleIds);
    ((rpData ?? []) as { project_id: string }[]).forEach(r => { if (r.project_id) projectIdsSet.add(r.project_id); });
  }

  // c) Desde user_projects
  if (userIds.length > 0) {
    const { data: upData } = await supabase
      .from('user_projects')
      .select('project_id')
      .in('user_id', userIds);
    ((upData ?? []) as { project_id: string }[]).forEach(r => { if (r.project_id) projectIdsSet.add(r.project_id); });
  }

  const allProjectIds = Array.from(projectIdsSet);

  type FieldReportRow = { id: string; project_id: string; operational_summary: { ml?: number }[] };

  let projects: Record<string, unknown>[] = [];
  const projectNames: string[] = [];

  if (allProjectIds.length > 0) {
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .in('id', allProjectIds)
      .order('name', { ascending: true });

    const rawProjects = ((projectsData ?? []) as unknown as Record<string, unknown>[]);

    const { data: reportsData } = await supabase
      .from('field_reports')
      .select('id, project_id, operational_summary')
      .in('project_id', allProjectIds);

    const reportsByProject: Record<string, FieldReportRow[]> = {};
    ((reportsData as unknown as FieldReportRow[]) ?? []).forEach((r) => {
      if (!reportsByProject[r.project_id]) reportsByProject[r.project_id] = [];
      reportsByProject[r.project_id].push(r);
    });

    rawProjects.forEach((p) => {
      const pName = String(p.name || '');
      if (pName) projectNames.push(pName);
    });

    const drawingHoursByName: Record<string, number> = {};
    const drawingCountByName: Record<string, number> = {};
    if (projectNames.length > 0) {
      const { data: drawings } = await supabase
        .from('drawing_activities')
        .select('project_name, hours_worked')
        .in('project_name', projectNames);
      (drawings ?? []).forEach((d: { project_name: string; hours_worked: number }) => {
        drawingHoursByName[d.project_name] = (drawingHoursByName[d.project_name] ?? 0) + (Number(d.hours_worked) || 0);
        drawingCountByName[d.project_name] = (drawingCountByName[d.project_name] ?? 0) + 1;
      });
    }

    projects = rawProjects.map((p) => {
      const pId = String(p.id);
      const pName = String(p.name || '');
      const reports = reportsByProject[pId] ?? [];
      const totalML = reports.reduce((sum: number, r: FieldReportRow) => {
        const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
        return sum + rows.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
      }, 0);
      const drawingCount = drawingCountByName[pName] ?? 0;
      const ccVal = String(p.cost_center || p.code || '—');
      return {
        id: pId,
        code: ccVal,
        cost_center: ccVal,
        name: pName,
        client: String(p.client || '—'),
        is_active: Boolean(p.is_active),
        total_ml: Math.round(totalML),
        total_drawing_hours: parseFloat((drawingHoursByName[pName] ?? 0).toFixed(1)),
        field_report_count: reports.length,
        drawing_count: drawingCount,
        report_count: reports.length + drawingCount,
      };
    });
  }

  // 5. Historial de Registros y Formularios (Logs de la División)
  type RawFieldReport = {
    id: string;
    report_date?: string;
    operator_name?: string;
    status?: string;
    operational_summary?: { ml?: number }[];
    docx_drive_url?: string;
    drive_session_folder_url?: string;
    created_at?: string;
    projects?: { name?: string; code?: string; cost_center?: string } | null;
  };

  type RawDrawingActivity = {
    id: string;
    activity_date?: string;
    responsible?: string;
    project_name?: string;
    hours_worked?: number;
    software?: string;
    is_rework?: boolean;
    created_at?: string;
  };

  const fieldLogs: Record<string, unknown>[] = [];
  if (allProjectIds.length > 0) {
    const { data: frData } = await supabase
      .from('field_reports')
      .select('id, report_date, operator_name, status, operational_summary, docx_drive_url, drive_session_folder_url, project_id, created_at, projects(name, cost_center)')
      .in('project_id', allProjectIds)
      .order('report_date', { ascending: false });

    ((frData as unknown as RawFieldReport[]) ?? []).forEach((fr) => {
      const rows = Array.isArray(fr.operational_summary) ? fr.operational_summary : [];
      const totalML = Math.round(rows.reduce((s, row) => s + (Number(row.ml) || 0), 0));
      const pCode = fr.projects?.cost_center || fr.projects?.code || '—';
      const pName = fr.projects?.name || '—';
      fieldLogs.push({
        id: fr.id,
        date: fr.report_date || fr.created_at || '',
        type: 'Campo GPR',
        form_name: 'Formulario Campo GPR',
        project_name: pName,
        project_code: pCode,
        operator_name: fr.operator_name || '—',
        detail: `${totalML} ml`,
        status: fr.status || 'Enviado',
        url: fr.docx_drive_url || fr.drive_session_folder_url || null,
        created_at: fr.created_at || fr.report_date || '',
      });
    });
  }

  const drawingLogs: Record<string, unknown>[] = [];
  if (projectNames.length > 0) {
    const { data: daData } = await supabase
      .from('drawing_activities')
      .select('id, activity_date, responsible, project_name, hours_worked, software, is_rework, created_at')
      .in('project_name', projectNames)
      .order('activity_date', { ascending: false });

    ((daData as unknown as RawDrawingActivity[]) ?? []).forEach((da) => {
      drawingLogs.push({
        id: da.id,
        date: da.activity_date || da.created_at || '',
        type: 'CAD/BIM',
        form_name: 'Registro CAD / BIM',
        project_name: da.project_name || '—',
        project_code: '—',
        operator_name: da.responsible || '—',
        detail: `${Number(da.hours_worked || 0).toFixed(1)} h (${da.software || 'CAD'})`,
        status: da.is_rework ? 'Reproceso' : 'Completado',
        url: null,
        created_at: da.created_at || da.activity_date || '',
      });
    });
  }

  const activity_logs = [...fieldLogs, ...drawingLogs].sort((a, b) => {
    const tA = new Date(String(a.date || a.created_at || 0)).getTime();
    const tB = new Date(String(b.date || b.created_at || 0)).getTime();
    return tB - tA;
  });

  type TypedProjStats = { is_active: boolean; total_ml: number; total_drawing_hours: number; field_report_count: number; drawing_count: number; report_count: number };
  const typedProjects = projects as unknown as TypedProjStats[];

  const stats = {
    role_count: roles.length,
    user_count: users.length,
    project_total: projects.length,
    project_active: typedProjects.filter((p) => p.is_active).length,
    total_ml: typedProjects.reduce((s, p) => s + p.total_ml, 0),
    total_drawing_hours: parseFloat(typedProjects.reduce((s, p) => s + p.total_drawing_hours, 0).toFixed(1)),
    total_field_reports: typedProjects.reduce((s, p) => s + p.field_report_count, 0),
    total_drawing_records: typedProjects.reduce((s, p) => s + p.drawing_count, 0),
    total_reports: typedProjects.reduce((s, p) => s + p.report_count, 0),
  };

  return NextResponse.json({ data: { ...division, roles, users, projects, stats, activity_logs } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  const updates: Record<string, string | null> = {};
  if (body.name?.trim()) updates.name = body.name.trim();
  if ('description' in body) updates.description = body.description?.trim() || null;

  const { data, error } = await supabase
    .from('divisions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(body.project_ids)) {
    await supabase.from('division_projects').delete().eq('division_id', id);
    if (body.project_ids.length > 0) {
      await supabase.from('division_projects').insert(
        body.project_ids.map((pid: string) => ({ division_id: id, project_id: pid }))
      );
    }
  }

  if (Array.isArray(body.role_ids)) {
    const newIds: string[] = body.role_ids.filter(Boolean);
    const { data: currentRoles } = await supabase.from('roles').select('id').eq('division_id', id);
    const currentIds = ((currentRoles ?? []) as { id: string }[]).map((r) => r.id);
    const toRemove = currentIds.filter((rid) => !newIds.includes(rid));
    const toAdd = newIds.filter((rid) => !currentIds.includes(rid));
    if (toRemove.length > 0) await supabase.from('roles').update({ division_id: null }).in('id', toRemove);
    if (toAdd.length > 0) await supabase.from('roles').update({ division_id: id }).in('id', toAdd);
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase.from('divisions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
