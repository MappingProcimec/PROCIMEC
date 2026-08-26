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

  const { data: division, error } = await supabase
    .from('divisions')
    .select('*, roles(id, name, is_system_role)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Proyectos vinculados a esta división a través de role_projects
  const roleIds = (division.roles as { id: string }[])?.map((r) => r.id) ?? [];
  let projects: unknown[] = [];
  if (roleIds.length > 0) {
    const { data: rp } = await supabase
      .from('role_projects')
      .select('projects(id, code, name, client)')
      .in('role_id', roleIds);
    const seen = new Set<string>();
    projects = (rp ?? [])
      .flatMap((r) => (r.projects ? [r.projects] : []))
      .filter((p) => {
        if (seen.has((p as unknown as { id: string }).id)) return false;
        seen.add((p as unknown as { id: string }).id);
        return true;
      });
  }

  return NextResponse.json({ data: { ...division, projects } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  const updates: Record<string, string> = {};
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
