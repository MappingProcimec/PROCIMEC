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

  const { data, error } = await supabase
    .from('divisions')
    .select(`
      id, name, description, created_at,
      roles(
        id,
        role_projects(
          project_id,
          projects(id, is_active)
        )
      )
    `)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type RawProject = { id: string; is_active: boolean };
  type RawRoleProject = { project_id: string; projects: RawProject | null };
  type RawRole = { id: string; role_projects: RawRoleProject[] };
  type RawDivision = {
    id: string; name: string; description: string | null; created_at: string;
    roles: RawRole[];
  };

  const divisions = (data as unknown as RawDivision[] ?? []).map((d) => {
    const roles = d.roles ?? [];
    const projectMap = new Map<string, boolean>();
    roles.forEach((r) =>
      (r.role_projects ?? []).forEach((rp) => {
        if (rp.projects) projectMap.set(rp.projects.id, rp.projects.is_active);
      })
    );
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.created_at,
      role_count: roles.length,
      project_total: projectMap.size,
      project_active: Array.from(projectMap.values()).filter(Boolean).length,
    };
  });

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

  let createdRoles: { id: string }[] = [];
  if (roleNames.length > 0) {
    const { data: roles } = await supabase
      .from('roles')
      .insert(roleNames.map((n) => ({ name: n, division_id: division.id })))
      .select('id');
    createdRoles = roles ?? [];
  }

  if (createdRoles.length > 0 && projectIds.length > 0) {
    const entries = createdRoles.flatMap((r) =>
      projectIds.map((p) => ({ role_id: r.id, project_id: p }))
    );
    await supabase.from('role_projects').insert(entries);
  }

  return NextResponse.json({ data: division }, { status: 201 });
}
