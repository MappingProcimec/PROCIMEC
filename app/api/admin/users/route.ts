import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
    .select('*, user_projects(project_id)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: users });
}

// PATCH /api/admin/users — update role, active status, or project assignments
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, role, is_active, project_ids } = body;
  if (!id) return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });

  const supabase = createAdminClient();

  // Update user fields
  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update project assignments if provided
  if (Array.isArray(project_ids)) {
    // Delete existing
    await supabase.from('user_projects').delete().eq('user_id', id);
    // Insert new
    if (project_ids.length > 0) {
      const rows = project_ids.map((pid: string) => ({ user_id: id, project_id: pid }));
      const { error } = await supabase.from('user_projects').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
