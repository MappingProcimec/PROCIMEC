import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/projects — returns projects for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const userId = session.user.id;
  const role = session.user.role;

  let query = supabase
    .from('projects')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Operators only see assigned projects
  if (role === 'operator') {
    const { data: assignments } = await supabase
      .from('user_projects')
      .select('project_id')
      .eq('user_id', userId);

    const projectIds = (assignments || []).map((a: { project_id: string }) => a.project_id);
    if (projectIds.length === 0) return NextResponse.json({ data: [] });
    query = query.in('id', projectIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
