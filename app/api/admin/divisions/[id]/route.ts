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

  const { data: division, error: divErr } = await supabase
    .from('divisions')
    .select('id, name, description, created_at')
    .eq('id', id)
    .single();

  if (divErr) return NextResponse.json({ error: divErr.message }, { status: 404 });

  // Roles with tool/form counts
  const { data: rolesRaw } = await supabase
    .from('roles')
    .select('id, name, is_system_role, role_tools(tool_id), role_forms(form_id)')
    .eq('division_id', id)
    .order('name', { ascending: true });

  type RawRole = { id: string; name: string; is_system_role: boolean; role_tools: { tool_id: string }[]; role_forms: { form_id: string }[] };
  const roles = ((rolesRaw as unknown as RawRole[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    is_system_role: r.is_system_role,
    tool_count: r.role_tools?.length ?? 0,
    form_count: r.role_forms?.length ?? 0,
  }));
  const roleIds = roles.map((r) => r.id);

  // Users assigned to this division's roles
  let users: { id: string; full_name: string; email: string; role_name: string }[] = [];
  if (roleIds.length > 0) {
    const { data: usersRaw } = await supabase
      .from('users')
      .select('id, full_name, email, role_id, roles(name)')
      .in('role_id', roleIds)
      .order('full_name', { ascending: true });

    type RawUser = { id: string; full_name: string; email: string; role_id: string; roles: { name: string } | null };
    users = ((usersRaw as unknown as RawUser[]) ?? []).map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role_name: u.roles?.name ?? '—',
    }));
  }

  // Projects via role_projects
  let projects: {
    id: string; code: string; name: string; client: string; is_active: boolean;
    total_ml: number; total_drawing_hours: number; report_count: number;
  }[] = [];

  if (roleIds.length > 0) {
    const { data: rpRaw } = await supabase
      .from('role_projects')
      .select('project_id, projects(id, code, name, client, is_active, field_reports(id, operational_summary))')
      .in('role_id', roleIds);

    type FieldReport = { id: string; operational_summary: { ml?: number }[] };
    type RawProject = { id: string; code: string; name: string; client: string; is_active: boolean; field_reports: FieldReport[] };
    type RawRP = { project_id: string; projects: RawProject | null };

    const projectMap = new Map<string, { proj: RawProject }>();
    ((rpRaw as unknown as RawRP[]) ?? []).forEach((rp) => {
      if (rp.projects && !projectMap.has(rp.projects.id)) {
        projectMap.set(rp.projects.id, { proj: rp.projects });
      }
    });

    const projectNames = Array.from(projectMap.values()).map((v) => v.proj.name);
    const drawingHoursByName: Record<string, number> = {};
    if (projectNames.length > 0) {
      const { data: drawings } = await supabase
        .from('drawing_activities')
        .select('project_name, hours_worked')
        .in('project_name', projectNames);
      (drawings ?? []).forEach((d: { project_name: string; hours_worked: number }) => {
        drawingHoursByName[d.project_name] = (drawingHoursByName[d.project_name] ?? 0) + (Number(d.hours_worked) || 0);
      });
    }

    projects = Array.from(projectMap.values()).map(({ proj }) => {
      const totalML = (proj.field_reports ?? []).reduce((sum: number, r: FieldReport) => {
        const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
        return sum + rows.reduce((s: number, row: { ml?: number }) => s + (Number(row.ml) || 0), 0);
      }, 0);
      return {
        id: proj.id,
        code: proj.code,
        name: proj.name,
        client: proj.client,
        is_active: proj.is_active,
        total_ml: Math.round(totalML),
        total_drawing_hours: drawingHoursByName[proj.name] ?? 0,
        report_count: proj.field_reports?.length ?? 0,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Update role user_count
  const userCountByRole: Record<string, number> = {};
  users.forEach((u) => {
    const roleId = (u as unknown as { role_id?: string }).role_id ?? '';
    userCountByRole[roleId] = (userCountByRole[roleId] ?? 0) + 1;
  });

  const rolesWithUsers = roles.map((r) => ({ ...r, user_count: userCountByRole[r.id] ?? 0 }));

  return NextResponse.json({
    data: {
      ...division,
      roles: rolesWithUsers,
      users,
      projects,
      stats: {
        role_count: roles.length,
        user_count: users.length,
        project_total: projects.length,
        project_active: projects.filter((p) => p.is_active).length,
        total_ml: projects.reduce((s, p) => s + p.total_ml, 0),
        total_drawing_hours: projects.reduce((s, p) => s + p.total_drawing_hours, 0),
        total_reports: projects.reduce((s, p) => s + p.report_count, 0),
      },
    },
  });
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
