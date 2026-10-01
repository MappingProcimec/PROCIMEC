import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userRole = session.user.role;
  const userId = session.user.id;

  if (userRole === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Validar permisos: rol compras, admin, gerencia o asignación en user_tools
  let hasAccess = userRole === 'admin' || userRole === 'purchasing' || userRole === 'compras' || userRole === 'management' || userRole === 'gerencia';
  if (!hasAccess && userId) {
    try {
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'purchasing-dashboard')
        .maybeSingle();

      if (ut) hasAccess = true;
    } catch {
      // Ignorar si la tabla no responde y mantener denegado por defecto
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'No tienes permisos para consultar la Gestión de Compras.' },
      { status: 403 }
    );
  }

  try {
    const [requestsRes, ordersRes, evaluationsRes] = await Promise.all([
      supabase
        .from('purchase_requests')
        .select(`
          id,
          project_id,
          user_id,
          title,
          category,
          priority,
          required_date,
          items,
          justification,
          status,
          created_at,
          projects(id, name, cost_center),
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false }),

      supabase
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
          projects(id, name, cost_center),
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false }),

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
        .order('created_at', { ascending: false })
    ]);

    const requests = requestsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const evaluations = evaluationsRes.data ?? [];

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
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
