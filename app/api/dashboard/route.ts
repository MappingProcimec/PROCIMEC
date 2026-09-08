import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

type Tool = { id: string; slug: string; name: string; category: string };
type Form = { id: string; slug: string; name: string };
type Project = { id: string; cost_center?: string; code?: string; name: string; client: string };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const roleIdParam = req.nextUrl.searchParams.get('roleId');

  const supabase = createAdminClient();
  const email = session.user.email;

  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, role, role_id, division_id')
    .eq('email', email)
    .single();

  if (userError || !dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  let division: { id: string; name: string } | null = null;
  let role: { id: string; name: string } | null = null;
  let tools: Tool[] = [];
  let forms: Form[] = [];
  let projects: Project[] = [];

  if (dbUser.division_id) {
    const { data } = await supabase
      .from('divisions')
      .select('id, name')
      .eq('id', dbUser.division_id)
      .single();
    division = data as { id: string; name: string } | null;
  }

  // Resolve effective role_id
  let effectiveRoleId: string | null = (dbUser.role === 'admin' && roleIdParam) ? roleIdParam : (dbUser.role_id ?? null);

  if (!effectiveRoleId) {
    const { data: udr } = await supabase
      .from('user_division_roles')
      .select('role_id')
      .eq('user_id', dbUser.id)
      .not('role_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (udr?.role_id) {
      effectiveRoleId = udr.role_id;
    }
  }

  if (!effectiveRoleId && dbUser.role) {
    const { data: matchedRole } = await supabase
      .from('roles')
      .select('id, name')
      .ilike('name', dbUser.role as string)
      .maybeSingle();
    if (matchedRole) {
      effectiveRoleId = matchedRole.id as string;
    }
  }

  if (dbUser.role === 'admin') {
    if (roleIdParam) {
      // Modo previsualización de rol para administrador
      const [roleResult, toolsResult, formsResult, projectsResult] = await Promise.all([
        supabase.from('roles').select('id, name').eq('id', roleIdParam).single(),
        supabase.from('role_tools').select('tools(id, slug, name, category)').eq('role_id', roleIdParam),
        supabase.from('role_forms').select('forms(id, slug, name)').eq('role_id', roleIdParam),
        supabase.from('role_projects').select('projects(id, cost_center, name, client)').eq('role_id', roleIdParam),
      ]);

      role = roleResult.data as { id: string; name: string } | null;
      tools = (toolsResult.data ?? [])
        .map((rt) => (rt as unknown as { tools: Tool | null }).tools)
        .filter((t): t is Tool => t !== null);
      forms = (formsResult.data ?? [])
        .map((rf) => (rf as unknown as { forms: Form | null }).forms)
        .filter((f): f is Form => f !== null);
      projects = (projectsResult.data ?? [])
        .map((rp) => (rp as unknown as { projects: Project | null }).projects)
        .filter((p): p is Project => p !== null)
        .map((p) => {
          const cc = p.cost_center || p.code || '';
          return { ...p, cost_center: cc, code: cc };
        });
    } else {
      // Administrador: acceso completo a todas las herramientas, formularios y proyectos activos
      const [allToolsRes, allFormsRes, allProjectsRes] = await Promise.all([
        supabase.from('tools').select('id, slug, name, category').not('slug', 'in', '("forms-area","projects-area")'),
        supabase.from('forms').select('id, slug, name'),
        supabase.from('projects').select('id, cost_center, code, name, client').eq('is_active', true),
      ]);

      tools = (allToolsRes.data ?? []) as Tool[];
      forms = (allFormsRes.data ?? []) as Form[];
      projects = ((allProjectsRes.data ?? []) as unknown as Project[]).map((p) => {
        const cc = p.cost_center || p.code || '';
        return { ...p, cost_center: cc, code: cc };
      });
    }
  } else if (dbUser.role === 'pending') {
    // Usuario pendiente: sin acceso
    tools = [];
    forms = [];
    projects = [];
  } else {
    // Colaborador: Las herramientas y formularios son ÚNICAMENTE las asignadas explícitamente en "Editar Usuario" (user_tools y user_forms)
    const [userToolsRes, userFormsRes, userProjectsRes, roleRes] = await Promise.all([
      supabase.from('user_tools').select('tools(id, slug, name, category)').eq('user_id', dbUser.id),
      supabase.from('user_forms').select('forms(id, slug, name)').eq('user_id', dbUser.id),
      supabase.from('user_projects').select('projects(id, cost_center, code, name, client)').eq('user_id', dbUser.id),
      effectiveRoleId ? supabase.from('roles').select('id, name').eq('id', effectiveRoleId).single() : Promise.resolve({ data: null }),
    ]);

    role = roleRes.data as { id: string; name: string } | null;

    tools = (userToolsRes.data ?? [])
      .map((ut) => (ut as unknown as { tools: Tool | null }).tools)
      .filter((t): t is Tool => t !== null);

    forms = (userFormsRes.data ?? [])
      .map((uf) => (uf as unknown as { forms: Form | null }).forms)
      .filter((f): f is Form => f !== null);

    projects = (userProjectsRes.data ?? [])
      .map((up) => (up as unknown as { projects: Project | null }).projects)
      .filter((p): p is Project => p !== null)
      .map((p) => {
        const cc = p.cost_center || p.code || '';
        return { ...p, cost_center: cc, code: cc };
      });
  }

  const { data: cadActivity } = await supabase
    .from('cad_activities')
    .select('id, date, phase, projects(name, cost_center)')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  type CadRow = { id: string; date: string; phase: string; projects: { name: string; cost_center?: string; code?: string } | null };
  const recentActivity = (cadActivity ?? []).map((a) => {
    const row = a as unknown as CadRow;
    return {
      id: row.id,
      date: row.date,
      type: 'CAD/BIM',
      formSlug: 'cad-register-form',
      projectName: row.projects?.name ?? '—',
      projectCode: row.projects?.cost_center ?? row.projects?.code ?? '—',
      detail: row.phase,
    };
  });

  const isRolePreview = Boolean(dbUser.role === 'admin' && roleIdParam);

  return NextResponse.json({
    data: {
      user: { id: dbUser.id, email: dbUser.email, full_name: dbUser.full_name },
      legacyRole: (dbUser.role as string) ?? null,
      isRolePreview,
      division,
      role,
      projects,
      tools,
      forms,
      recentActivity,
    },
  });
}
