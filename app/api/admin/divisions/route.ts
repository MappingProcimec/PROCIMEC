import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Divisiones con sus roles
  const { data: divData, error } = await supabase
    .from('divisions')
    .select('id, name, description, created_at, roles(id)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Proyectos por división desde division_projects, role_projects y user_projects
  const { data: dpData } = await supabase
    .from('division_projects')
    .select('division_id, project_id, projects(id, is_active)');

  const { data: rpData } = await supabase
    .from('role_projects')
    .select('project_id, roles(division_id), projects(id, is_active)');

  type DPRow = { division_id: string; project_id: string; projects: { id: string; is_active: boolean } | null };
  const projectsByDivMap: Record<string, Map<string, boolean>> = {};

  ((dpData as unknown as DPRow[]) ?? []).forEach((row) => {
    if (!row.division_id || !row.projects?.id) return;
    if (!projectsByDivMap[row.division_id]) projectsByDivMap[row.division_id] = new Map();
    projectsByDivMap[row.division_id].set(row.projects.id, Boolean(row.projects.is_active));
  });

  type RPRow = { project_id: string; roles: { division_id: string } | null; projects: { id: string; is_active: boolean } | null };
  ((rpData as unknown as RPRow[]) ?? []).forEach((row) => {
    const divId = row.roles?.division_id;
    if (!divId || !row.projects?.id) return;
    if (!projectsByDivMap[divId]) projectsByDivMap[divId] = new Map();
    projectsByDivMap[divId].set(row.projects.id, Boolean(row.projects.is_active));
  });

  const projectsByDiv: Record<string, { active: number; total: number }> = {};
  Object.entries(projectsByDivMap).forEach(([divId, projMap]) => {
    let total = 0;
    let active = 0;
    projMap.forEach((isActive) => {
      total++;
      if (isActive) active++;
    });
    projectsByDiv[divId] = { total, active };
  });

  type RawDiv = { id: string; name: string; description: string | null; created_at: string; roles: { id: string }[] };
  const divisions = ((divData as unknown as RawDiv[]) ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    created_at: d.created_at,
    role_count: d.roles?.length ?? 0,
    project_total: projectsByDiv[d.id]?.total ?? 0,
    project_active: projectsByDiv[d.id]?.active ?? 0,
  }));

  return NextResponse.json({ data: divisions });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const name = (body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });

  const roleNames: string[] = (body.role_names ?? []).map((n: string) => n.trim()).filter(Boolean);
  const projectIds: string[] = body.project_ids ?? [];

  const supabase = createAdminClient();

  const { data: division, error } = await supabase
    .from('divisions')
    .insert({ name, description: body.description?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (roleNames.length > 0) {
    await supabase
      .from('roles')
      .insert(roleNames.map((n) => ({ name: n, division_id: division.id })));
  }

  const roleIds: string[] = (body.role_ids ?? []).filter(Boolean);
  if (roleIds.length > 0) {
    await supabase.from('roles').update({ division_id: division.id }).in('id', roleIds);
  }

  if (projectIds.length > 0) {
    await supabase
      .from('division_projects')
      .insert(projectIds.map((p) => ({ division_id: division.id, project_id: p })));
  }

  return NextResponse.json({ data: division }, { status: 201 });
}
