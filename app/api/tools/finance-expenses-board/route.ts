import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
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

  // Validar permisos: rol finanzas, admin, gerencia o asignación en user_tools
  let hasAccess = userRole === 'admin' || userRole === 'finance' || userRole === 'finanzas' || userRole === 'management' || userRole === 'gerencia';
  if (!hasAccess && userId) {
    try {
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'finance-expenses-board')
        .maybeSingle();

      if (ut) hasAccess = true;
    } catch {
      // Ignorar si la tabla no responde
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'No tienes permisos para consultar el Control de Viáticos y Finanzas.' },
      { status: 403 }
    );
  }

  try {
    const [perDiemsRes, legalizationsRes, paymentsRes] = await Promise.all([
      supabase
        .from('per_diem_requests')
        .select(`
          id,
          project_id,
          user_id,
          destination,
          departure_date,
          return_date,
          estimated_days,
          lodging_budget,
          food_budget,
          transport_budget,
          tolls_fuel_budget,
          total_requested,
          notes,
          status,
          created_at,
          projects(id, name, cost_center),
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('expense_legalizations')
        .select(`
          id,
          per_diem_request_id,
          user_id,
          total_received,
          total_spent,
          balance_difference,
          balance_type,
          receipt_count,
          notes,
          status,
          created_at,
          users(id, full_name, email),
          per_diem_requests(destination, departure_date, return_date)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('payment_records')
        .select(`
          id,
          project_id,
          user_id,
          payment_type,
          beneficiary_name,
          beneficiary_doc,
          amount,
          currency,
          bank_name,
          transaction_reference,
          payment_date,
          notes,
          status,
          created_at,
          projects(id, name, cost_center),
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false })
    ]);

    const perDiems = perDiemsRes.data ?? [];
    const legalizations = legalizationsRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    const totalDisbursedCOP = perDiems
      .filter((p) => p.status === 'disbursed' || p.status === 'approved')
      .reduce((acc, curr) => acc + (Number(curr.total_requested) || 0), 0);

    const pendingLegalizations = perDiems.filter((p) => p.status === 'disbursed');
    const totalPaymentsCOP = payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalLegalizedCOP = legalizations.reduce((acc, curr) => acc + (Number(curr.total_spent) || 0), 0);

    const stats = {
      totalDisbursedCOP,
      pendingLegalizationsCount: pendingLegalizations.length,
      totalPaymentsCOP,
      totalLegalizedCOP,
    };

    return NextResponse.json({
      data: {
        stats,
        perDiems,
        legalizations,
        payments,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
