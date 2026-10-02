import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Obtener usuario de la base de datos
  let dbUser: { id: string; full_name?: string | null; email: string; role: string; role_id?: string | null } | null = null;
  try {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, full_name, email, role, role_id')
      .ilike('email', session.user.email.trim())
      .maybeSingle();

    if (userByEmail) {
      dbUser = userByEmail;
    } else if (session.user.id) {
      const { data: userById } = await supabase
        .from('users')
        .select('id, full_name, email, role, role_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (userById) dbUser = userById;
    }
  } catch (err) {
    console.warn('Error consultando usuario en purchasing-dashboard:', err);
  }

  if (!dbUser) {
    dbUser = {
      id: session.user.id || '',
      full_name: session.user.name || '',
      email: session.user.email,
      role: session.user.role || 'operator',
    };
  }

  if (dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  const userRole = dbUser.role;
  const userId = dbUser.id;

  // 2. Validar permisos: rol compras, admin, gerencia o asignación en user_tools / role_tools
  let hasAccess =
    userRole === 'admin' ||
    userRole === 'purchasing' ||
    userRole === 'compras' ||
    userRole === 'management' ||
    userRole === 'gerencia' ||
    session.user.role === 'admin' ||
    session.user.role === 'management';

  if (!hasAccess && userId) {
    try {
      // Verificar user_tools
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'purchasing-dashboard')
        .maybeSingle();

      if (ut) {
        hasAccess = true;
      } else if (dbUser.role_id) {
        // Verificar role_tools
        const { data: rt } = await supabase
          .from('role_tools')
          .select('tools!inner(slug)')
          .eq('role_id', dbUser.role_id)
          .eq('tools.slug', 'purchasing-dashboard')
          .maybeSingle();

        if (rt) hasAccess = true;
      }
    } catch (e) {
      console.warn('Error verificando permisos de herramienta en purchasing-dashboard:', e);
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'No tienes permisos habilitados para consultar la Gestión de Compras.' },
      { status: 403 }
    );
  }

  // 3. Determinar proyectos asignados al usuario (para filtrado canónico)
  const isGlobalManager =
    userRole === 'admin' ||
    userRole === 'management' ||
    userRole === 'gerencia' ||
    session.user.role === 'admin' ||
    session.user.role === 'management';

  let assignedProjectIds: string[] = [];
  let availableProjects: Array<{ id: string; name: string; cost_center: string; client: string }> = [];

  try {
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, name, cost_center, client, is_active')
      .order('name', { ascending: true });

    const activeProjects = (allProjects || []).filter((p) => p.is_active !== false);

    if (userId) {
      const { data: userProjects } = await supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', userId);

      const userSet = new Set((userProjects || []).map((up: { project_id: string }) => up.project_id));
      assignedProjectIds = Array.from(userSet);

      if (isGlobalManager && assignedProjectIds.length === 0) {
        // Administradores sin restricción ven todos los proyectos
        availableProjects = activeProjects.map((p) => ({
          id: p.id,
          name: p.name || '',
          cost_center: String(p.cost_center || '').trim(),
          client: String(p.client || '').trim(),
        }));
      } else {
        // Usuario con proyectos asignados: restringir a sus proyectos
        availableProjects = activeProjects
          .filter((p) => userSet.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name || '',
            cost_center: String(p.cost_center || '').trim(),
            client: String(p.client || '').trim(),
          }));
      }
    }
  } catch (err) {
    console.warn('Error consultando proyectos asignados:', err);
  }

  // Si no es administrador global y no tiene proyectos asignados, retornar listas vacías
  if (!isGlobalManager && assignedProjectIds.length === 0) {
    return NextResponse.json({
      data: {
        stats: {
          pendingRequests: 0,
          activeOrders: 0,
          totalCommittedCOP: 0,
          evaluatedSuppliers: 0,
        },
        requests: [],
        orders: [],
        evaluations: [],
        projects: [],
      },
    });
  }

  // 4. Consultar datos con filtros de proyectos correspondientes
  try {
    let requestsQuery = supabase
      .from('purchase_requests')
      .select(`
        *,
        projects(id, name, cost_center, client),
        users!purchase_requests_user_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    let ordersQuery = supabase
      .from('purchase_orders')
      .select(`
        id,
        purchase_request_id,
        project_id,
        user_id,
        order_code,
        supplier_name,
        supplier_nit,
        supplier_contact,
        total_amount,
        currency,
        delivery_deadline,
        payment_terms,
        attachment_url,
        notes,
        status,
        created_at,
        projects(id, name, cost_center, client),
        users(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    // Filtrar por proyecto específico si el usuario no es global o si pasó el parámetro project_id
    const requestedProjectId = req.nextUrl.searchParams.get('project_id');
    if (requestedProjectId) {
      if (!isGlobalManager && !assignedProjectIds.includes(requestedProjectId)) {
        return NextResponse.json({ error: 'No tienes acceso a los requerimientos de este proyecto.' }, { status: 403 });
      }
      requestsQuery = requestsQuery.eq('project_id', requestedProjectId);
      ordersQuery = ordersQuery.eq('project_id', requestedProjectId);
    } else if (!isGlobalManager) {
      requestsQuery = requestsQuery.in('project_id', assignedProjectIds);
      ordersQuery = ordersQuery.in('project_id', assignedProjectIds);
    }

    const [requestsRes, ordersRes, evaluationsRes] = await Promise.all([
      requestsQuery,
      ordersQuery,
      supabase
        .from('supplier_evaluations')
        .select(`
          id,
          purchase_order_id,
          user_id,
          supplier_name,
          quality_score,
          delivery_time_score,
          service_score,
          overall_rating,
          comments,
          recommend_supplier,
          created_at,
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false }),
    ]);

    const rawRequests = requestsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const evaluations = evaluationsRes.data ?? [];

    // Normalizar solicitudes para garantizar compatibilidad con esquema extendido y fallback
    const requests = rawRequests.map((r: Record<string, unknown>) => {
      let itemsList = r.items;
      let meta: Record<string, unknown> = {};

      if (itemsList && typeof itemsList === 'object' && !Array.isArray(itemsList)) {
        const obj = itemsList as Record<string, unknown>;
        if (Array.isArray(obj.items)) {
          meta = (obj._metadata as Record<string, unknown>) || {};
          itemsList = obj.items;
        }
      }

      const consecutive =
        (typeof r.consecutive === 'number' ? r.consecutive : null) ||
        (typeof meta.consecutive === 'number' ? meta.consecutive : null) ||
        null;

      const requestCode =
        (r.request_code as string) ||
        (meta.request_code as string) ||
        (consecutive ? `REQ-${String(consecutive).padStart(4, '0')}` : 'REQ-0001');

      const userObj = r.users as { full_name?: string; email?: string } | null;
      const projObj = r.projects as { name?: string; cost_center?: string; client?: string } | null;

      const applicantName =
        (r.applicant_name as string) ||
        (meta.applicant_name as string) ||
        userObj?.full_name ||
        userObj?.email ||
        '';

      const applicantCedula =
        (r.applicant_cedula as string) ||
        (meta.applicant_cedula as string) ||
        '';

      const approverName = (r.approver_name as string) || (meta.approver_name as string) || '';
      const deliveryDate =
        (r.delivery_date as string) ||
        (meta.delivery_date as string) ||
        (r.required_date as string) ||
        '';

      const deliverySite = (r.delivery_site as string) || (meta.delivery_site as string) || '';
      const contactPhone = (r.contact_phone as string) || (meta.contact_phone as string) || '';
      const costCenter =
        (r.cost_center as string) ||
        (meta.cost_center as string) ||
        projObj?.cost_center ||
        '';

      const clientName =
        (r.client_name as string) ||
        (meta.client_name as string) ||
        projObj?.client ||
        '';

      const parsedItems = Array.isArray(itemsList) ? itemsList : [];
      let totalAmount =
        Number(r.total_amount) ||
        Number(meta.total_amount) ||
        0;

      if (!totalAmount && parsedItems.length > 0) {
        totalAmount = parsedItems.reduce((acc: number, it: Record<string, unknown>) => {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.unit_price) || 0;
          const t = Number(it.total) || qty * price;
          return acc + t;
        }, 0);
      }

      let signatures = (r.signatures as Record<string, unknown>) || {};
      let viewedBy = (r.viewed_by as Array<Record<string, unknown>>) || [];
      if ((!signatures || Object.keys(signatures).length === 0) && meta.signatures) {
        signatures = meta.signatures as Record<string, unknown>;
      }
      if ((!viewedBy || viewedBy.length === 0) && Array.isArray(meta.viewed_by)) {
        viewedBy = meta.viewed_by as Array<Record<string, unknown>>;
      }

      if (!signatures.applicant && applicantName) {
        signatures = {
          ...signatures,
          applicant: {
            name: applicantName,
            cedula: applicantCedula,
            date_time: (r.created_at as string) || '',
            role_label: 'Solicitante / Ingeniero de Campo',
          },
        };
      }

      return {
        ...r,
        id: (r.id as string) || '',
        title: (r.title as string) || '',
        status: (r.status as string) || 'pending',
        category: (r.category as string) || 'insumos_campo',
        priority: (r.priority as string) || 'media',
        created_at: (r.created_at as string) || '',
        project_id: (r.project_id as string) || '',
        user_id: (r.user_id as string) || '',
        consecutive,
        request_code: requestCode,
        applicant_name: applicantName,
        applicant_cedula: applicantCedula,
        approver_name: approverName,
        delivery_date: deliveryDate,
        delivery_site: deliverySite,
        contact_phone: contactPhone,
        cost_center: costCenter,
        client_name: clientName,
        total_amount: totalAmount,
        items: parsedItems,
        signatures,
        viewed_by: viewedBy,
      };
    });

    const stats = {
      pendingRequests: requests.filter((r) => r.status === 'pending' || r.status === 'in_quotation').length,
      activeOrders: orders.filter((o) => o.status === 'issued' || o.status === 'partially_received').length,
      totalCommittedCOP: orders.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0),
      evaluatedSuppliers: evaluations.length,
    };

    return NextResponse.json({
      data: {
        stats,
        requests,
        orders,
        evaluations,
        projects: availableProjects,
        currentUser: {
          id: dbUser.id,
          name: dbUser.full_name || session.user.name || '',
          email: dbUser.email || session.user.email || '',
          role: dbUser.role || session.user.role || 'operator',
        },
      },
    });
  } catch (err: unknown) {
    console.error('Error procesando datos en purchasing-dashboard:', err);
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
