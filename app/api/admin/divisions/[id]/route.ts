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

  // 4. Proyectos desde division_projects (relación directa)
  type ProjectRow = { id: string; code: string; name: string; client: string; is_active: boolean };
  type FieldReportRow = { id: string; project_id: string; operational_summary: { ml?: number }[] };

  let projects: (ProjectRow & { total_ml: number; total_drawing_hours: number; field_report_count: number; drawing_count: number; report_count: number })[] = [];

  const { data: dpData } = await supabase
    .from('division_projects')
    .select('project_id')
    .eq('division_id', id);

  const projectIds = ((dpData ?? []) as { project_id: string }[]).map((r) => r.project_id);

  if (projectIds.length > 0) {
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, code, name, client, is_active')
      .in('id', projectIds)
      .order('name', { ascending: true });

    const projectsTyped = (projectsData as unknown as ProjectRow[]) ?? [];
    const projectNames = projectsTyped.map((p) => p.name);

    const { data: reportsData } = await supabase
      .from('field_reports')
      .select('id, project_id, operational_summary')
      .in('project_id', projectIds);

    const reportsByProject: Record<string, FieldReportRow[]> = {};
    ((reportsData as unknown as FieldReportRow[]) ?? []).forEach((r) => {
      if (!reportsByProject[r.project_id]) reportsByProject[r.project_id] = [];
      reportsByProject[r.project_id].push(r);
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

    projects = projectsTyped.map((p) => {
      const reports = reportsByProject[p.id] ?? [];
      const totalML = reports.reduce((sum: number, r: FieldReportRow) => {
        const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
        return sum + rows.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
      }, 0);
      const drawingCount = drawingCountByName[p.name] ?? 0;
      return {
        ...p,
        total_ml: Math.round(totalML),
        total_drawing_hours: parseFloat((drawingHoursByName[p.name] ?? 0).toFixed(1)),
        field_report_count: reports.length,
        drawing_count: drawingCount,
        report_count: reports.length + drawingCount,
      };
    });
  }

  const stats = {
    role_count: roles.length,
    user_count: users.length,
    project_total: projects.length,
    project_active: projects.filter((p) => p.is_active).length,
    total_ml: projects.reduce((s, p) => s + p.total_ml, 0),
    total_drawing_hours: parseFloat(projects.reduce((s, p) => s + p.total_drawing_hours, 0).toFixed(1)),
    total_field_reports: projects.reduce((s, p) => s + p.field_report_count, 0),
    total_drawing_records: projects.reduce((s, p) => s + p.drawing_count, 0),
    total_reports: projects.reduce((s, p) => s + p.report_count, 0),
  };

  return NextResponse.json({ data: { ...division, roles, users, projects, stats } });
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
