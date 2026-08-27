import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/users
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('*, role_id, roles(id, name), user_projects(project_id), user_division_roles(division_id, role_id)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: users });
}

// PATCH /api/admin/users — update role, active status, project assignments, division roles
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, role, is_active, project_ids, role_id, division_roles } = body;
  if (!id) return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (role_id !== undefined) updates.role_id = role_id || null;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync project assignments
  if (Array.isArray(project_ids)) {
    await supabase.from('user_projects').delete().eq('user_id', id);
    if (project_ids.length > 0) {
      const { error } = await supabase.from('user_projects').insert(
        project_ids.map((pid: string) => ({ user_id: id, project_id: pid }))
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Sync user_division_roles
  if (Array.isArray(division_roles)) {
    await supabase.from('user_division_roles').delete().eq('user_id', id);
    type DR = { division_id: string; role_id: string | null };
    const valid = (division_roles as DR[]).filter(dr => dr.division_id);
    if (valid.length > 0) {
      await supabase.from('user_division_roles').insert(
        valid.map(dr => ({ user_id: id, division_id: dr.division_id, role_id: dr.role_id || null }))
      );
    }
  }

  return NextResponse.json({ success: true });
}
