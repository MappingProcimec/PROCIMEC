import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  let { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, nick_name, role, role_id, division_id')
    .eq('email', email)
    .single();

  if (userError && (userError.message?.includes('nick_name') || userError.code === '42703')) {
    const fallbackRes = await supabase
      .from('users')
      .select('id, email, full_name, role, role_id, division_id')
      .eq('email', email)
      .single();
    dbUser = fallbackRes.data ? { ...fallbackRes.data, nick_name: fallbackRes.data.full_name } : null;
    userError = fallbackRes.error;
  }

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
    const roleSearchMap: Record<string, string> = {
      warehouse: 'Almacén',
      purchasing: 'Compras',
      commercial: 'Comercial',
      finance: 'Finanzas',
      accounting: 'Contabilidad',
      management: 'Gerencia',
    };
    const roleSearch = roleSearchMap[dbUser.role] ?? (dbUser.role as string);
    const { data: matchedRole } = await supabase
      .from('roles')
      .select('id, name')
      .ilike('name', roleSearch)
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
        supabase.from('projects').select('id, cost_center, name, client').eq('is_active', true),
      ]);

      tools = (allToolsRes.data ?? []) as Tool[];
      forms = (allFormsRes.data ?? []) as Form[];

      const toolSlugs = new Set(tools.map((t) => t.slug));
      if (!toolSlugs.has('evidence-board')) {
        tools.push({ id: 'evidence-board', slug: 'evidence-board', name: 'Tablero de Evidencias HSEQ', category: 'hseq' });
      }
      if (!toolSlugs.has('warehouse-inventory')) {
        tools.push({ id: 'warehouse-inventory', slug: 'warehouse-inventory', name: 'Kárdex e Inventario Activo de Bodega', category: 'warehouse' });
      }

      const formSlugs = new Set(forms.map((f) => f.slug));
      if (!formSlugs.has('hseq-report')) {
        forms.push({ id: 'hseq-report', slug: 'hseq-report', name: 'Formulario de Inspección HSEQ' });
      }
      if (!formSlugs.has('registro-equipo')) {
        forms.push({ id: 'registro-equipo', slug: 'registro-equipo', name: 'Movimientos y Registro de Almacén' });
      }

      // Formularios corporativos para Admin
      if (!formSlugs.has('requerimiento-compra')) forms.push({ id: 'requerimiento-compra', slug: 'requerimiento-compra', name: 'Requerimiento de Compra' });
      if (!formSlugs.has('orden-compra')) forms.push({ id: 'orden-compra', slug: 'orden-compra', name: 'Orden de Compra y Adjudicación' });
      if (!formSlugs.has('evaluacion-proveedor')) forms.push({ id: 'evaluacion-proveedor', slug: 'evaluacion-proveedor', name: 'Evaluación y Recepción de Proveedor' });
      if (!formSlugs.has('registro-oportunidad')) forms.push({ id: 'registro-oportunidad', slug: 'registro-oportunidad', name: 'Registro de Oportunidad / Licitación' });
      if (!formSlugs.has('cotizacion-comercial')) forms.push({ id: 'cotizacion-comercial', slug: 'cotizacion-comercial', name: 'Cotización Comercial Emitida' });
      if (!formSlugs.has('cierre-comercial')) forms.push({ id: 'cierre-comercial', slug: 'cierre-comercial', name: 'Cierre de Negociación' });
      if (!formSlugs.has('solicitud-viaticos')) forms.push({ id: 'solicitud-viaticos', slug: 'solicitud-viaticos', name: 'Solicitud de Viáticos y Anticipos' });
      if (!formSlugs.has('legalizacion-gastos')) forms.push({ id: 'legalizacion-gastos', slug: 'legalizacion-gastos', name: 'Legalización y Rendición de Gastos' });
      if (!formSlugs.has('registro-pago')) forms.push({ id: 'registro-pago', slug: 'registro-pago', name: 'Comprobante de Egreso y Pago' });
      if (!formSlugs.has('radicacion-factura')) forms.push({ id: 'radicacion-factura', slug: 'radicacion-factura', name: 'Radicación de Factura Proveedor' });
      if (!formSlugs.has('soporte-cobro')) forms.push({ id: 'soporte-cobro', slug: 'soporte-cobro', name: 'Soporte de Cobro y Facturación' });

      // Dejar un solo formulario unificado para Almacén
      forms = forms
        .filter((f) => f.slug !== 'despacho-equipo' && f.slug !== 'retorno-equipo')
        .map((f) => f.slug === 'registro-equipo' ? { ...f, name: 'Movimientos y Registro de Almacén' } : f);

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
      supabase.from('user_projects').select('projects(id, cost_center, name, client)').eq('user_id', dbUser.id),
      effectiveRoleId ? supabase.from('roles').select('id, name').eq('id', effectiveRoleId).single() : Promise.resolve({ data: null }),
    ]);

    role = roleRes.data as { id: string; name: string } | null;

    tools = (userToolsRes.data ?? [])
      .map((ut) => (ut as unknown as { tools: Tool | null }).tools)
      .filter((t): t is Tool => t !== null);

    forms = (userFormsRes.data ?? [])
      .map((uf) => (uf as unknown as { forms: Form | null }).forms)
      .filter((f): f is Form => f !== null);

    if (dbUser.role === 'warehouse') {
      const toolSlugs = new Set(tools.map((t) => t.slug));
      if (!toolSlugs.has('warehouse-inventory')) {
        tools.push({ id: 'warehouse-inventory', slug: 'warehouse-inventory', name: 'Kárdex e Inventario Activo de Bodega', category: 'warehouse' });
      }
      const formSlugs = new Set(forms.map((f) => f.slug));
      if (!formSlugs.has('registro-equipo')) {
        forms.push({ id: 'registro-equipo', slug: 'registro-equipo', name: 'Movimientos y Registro de Almacén' });
      }
    } else if (dbUser.role === 'purchasing') {
      const formSlugs = new Set(forms.map((f) => f.slug));
      if (!formSlugs.has('requerimiento-compra')) forms.push({ id: 'requerimiento-compra', slug: 'requerimiento-compra', name: 'Requerimiento de Compra' });
      if (!formSlugs.has('orden-compra')) forms.push({ id: 'orden-compra', slug: 'orden-compra', name: 'Orden de Compra y Adjudicación' });
      if (!formSlugs.has('evaluacion-proveedor')) forms.push({ id: 'evaluacion-proveedor', slug: 'evaluacion-proveedor', name: 'Evaluación y Recepción de Proveedor' });
    } else if (dbUser.role === 'commercial') {
      const formSlugs = new Set(forms.map((f) => f.slug));
      if (!formSlugs.has('registro-oportunidad')) forms.push({ id: 'registro-oportunidad', slug: 'registro-oportunidad', name: 'Registro de Oportunidad / Licitación' });
      if (!formSlugs.has('cotizacion-comercial')) forms.push({ id: 'cotizacion-comercial', slug: 'cotizacion-comercial', name: 'Cotización Comercial Emitida' });
      if (!formSlugs.has('cierre-comercial')) forms.push({ id: 'cierre-comercial', slug: 'cierre-comercial', name: 'Cierre de Negociación' });
    } else if (dbUser.role === 'finance') {
      const formSlugs = new Set(forms.map((f) => f.slug));
      if (!formSlugs.has('solicitud-viaticos')) forms.push({ id: 'solicitud-viaticos', slug: 'solicitud-viaticos', name: 'Solicitud de Viáticos y Anticipos' });
      if (!formSlugs.has('legalizacion-gastos')) forms.push({ id: 'legalizacion-gastos', slug: 'legalizacion-gastos', name: 'Legalización y Rendición de Gastos' });
      if (!formSlugs.has('registro-pago')) forms.push({ id: 'registro-pago', slug: 'registro-pago', name: 'Comprobante de Egreso y Pago' });
    } else if (dbUser.role === 'accounting') {
      const formSlugs = new Set(forms.map((f) => f.slug));
      if (!formSlugs.has('radicacion-factura')) forms.push({ id: 'radicacion-factura', slug: 'radicacion-factura', name: 'Radicación de Factura Proveedor' });
      if (!formSlugs.has('soporte-cobro')) forms.push({ id: 'soporte-cobro', slug: 'soporte-cobro', name: 'Soporte de Cobro y Facturación' });
    }

    // Dejar un solo formulario unificado para Almacén
    forms = forms
      .filter((f) => f.slug !== 'despacho-equipo' && f.slug !== 'retorno-equipo')
      .map((f) => f.slug === 'registro-equipo' ? { ...f, name: 'Movimientos y Registro de Almacén' } : f);

    projects = (userProjectsRes.data ?? [])
      .map((up) => (up as unknown as { projects: Project | null }).projects)
      .filter((p): p is Project => p !== null)
      .map((p) => {
        const cc = p.cost_center || p.code || '';
        return { ...p, cost_center: cc, code: cc };
      });
  }

  let cadActivityQuery = supabase
    .from('drawing_activities')
    .select('id, activity_date, elaboration_stage, software, hours_worked, project_name')
    .order('activity_date', { ascending: false })
    .limit(5);

  if (dbUser.id && dbUser.email) {
    cadActivityQuery = cadActivityQuery.or(`user_id.eq.${dbUser.id},responsible.ilike.${dbUser.email}`);
  } else if (dbUser.id) {
    cadActivityQuery = cadActivityQuery.eq('user_id', dbUser.id);
  } else if (dbUser.email) {
    cadActivityQuery = cadActivityQuery.ilike('responsible', dbUser.email);
  }

  const { data: cadActivity } = await cadActivityQuery;

  type CadRow = {
    id: string;
    activity_date: string;
    elaboration_stage?: string | null;
    software?: string | null;
    hours_worked?: number | null;
    project_name?: string | null;
  };

  const recentActivity = (cadActivity ?? []).map((a) => {
    const row = a as unknown as CadRow;
    return {
      id: row.id,
      date: row.activity_date,
      type: 'CAD/BIM',
      formSlug: 'nueva-actividad',
      projectName: row.project_name ?? '—',
      projectCode: '—',
      detail: `${Number(row.hours_worked || 8.5).toFixed(1)} h (${row.software || 'CAD'})`,
    };
  });

  const isRolePreview = Boolean(dbUser.role === 'admin' && roleIdParam);

  return NextResponse.json(
    {
      data: {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          full_name: dbUser.full_name,
          nick_name: (dbUser as { nick_name?: string }).nick_name || dbUser.full_name,
        },
        legacyRole: (dbUser.role as string) ?? null,
        isRolePreview,
        division,
        role,
        projects,
        tools,
        forms,
        recentActivity,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
