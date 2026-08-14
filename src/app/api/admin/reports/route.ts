import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/reports/stats — for dashboard
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  let query = supabase
    .from('field_reports')
    .select(`
      *,
      projects(code, name, client),
      users(full_name)
    `)
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/reports — admin delete report
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('field_reports').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
