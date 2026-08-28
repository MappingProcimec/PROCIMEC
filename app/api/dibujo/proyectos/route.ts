import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAILS = [
  'mapping.procimec2024@gmail.com',
  'marcelobarrazasantiago@gmail.com',
];

function isKnownAdmin(email?: string | null): boolean {
  if (!email) return false;
  const envAdmin = process.env.GOOGLE_DRIVE_ADMIN_EMAIL;
  if (envAdmin && email.toLowerCase() === envAdmin.toLowerCase()) return true;
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase());
}

/**
 * GET /api/dibujo/proyectos
 * Devuelve los proyectos activos asignados al dibujante que hace la petición.
 * Los admins reciben todos los proyectos activos.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const email = token.email as string | undefined;

  // Verificar rol real en Supabase si el token dice pending
  let role = token.role as string;
  let userId: string | null = null;

  if (email) {
    if (isKnownAdmin(email)) {
      role = 'admin';
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    if (userRow) {
      if (!isKnownAdmin(email)) role = userRow.role;
      userId = userRow.id;
    }
  }

  if (role !== 'dibujo' && role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Admins: todos los proyectos activos
  if (role === 'admin') {
    const { data, error } = await supabase
      .from('projects')
      .select('id, cost_center, name, client, location')
      .eq('is_active', true)
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const formatted = (data || []).map((p: { id: string; cost_center?: string; name: string; client: string; location: string }) => ({
      ...p,
      cost_center: p.cost_center || '',
      code: p.cost_center || '',
    }));
    return NextResponse.json({ projects: formatted });
  }

  // Dibujantes: solo los proyectos asignados (activos)
  if (!userId) {
    return NextResponse.json({ projects: [] });
  }

  const { data: assigned, error: assignedError } = await supabase
    .from('user_projects')
    .select('project_id')
    .eq('user_id', userId);

  if (assignedError) {
    return NextResponse.json({ error: assignedError.message }, { status: 500 });
  }

  const projectIds = (assigned || []).map((r: { project_id: string }) => r.project_id);

  if (projectIds.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, cost_center, name, client, location')
    .in('id', projectIds)
    .eq('is_active', true)
    .order('name');

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const formattedAssigned = (projects || []).map((p: { id: string; cost_center?: string; name: string; client: string; location: string }) => ({
    ...p,
    cost_center: p.cost_center || '',
    code: p.cost_center || '',
  }));
  return NextResponse.json({ projects: formattedAssigned });
}
