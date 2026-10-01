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

  // Validar permisos: rol contabilidad, finanzas, admin, gerencia o asignación en user_tools
  let hasAccess = userRole === 'admin' || userRole === 'accounting' || userRole === 'contabilidad' || userRole === 'management' || userRole === 'gerencia' || userRole === 'finance';
  if (!hasAccess && userId) {
    try {
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'accounting-invoices-board')
        .maybeSingle();

      if (ut) hasAccess = true;
    } catch {
      // Ignorar si la tabla no responde
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'No tienes permisos para consultar la Gestión Contable y Facturación.' },
      { status: 403 }
    );
  }

  try {
    const [invoicesRes, supportsRes] = await Promise.all([
      supabase
        .from('invoice_filings')
        .select(`
          id,
          project_id,
          user_id,
          supplier_name,
          supplier_nit,
          invoice_number,
          invoice_date,
          due_date,
          subtotal,
          tax_amount,
          withholding_amount,
          total_amount,
          payment_status,
          payment_due_days,
          status,
          attachment_url,
          notes,
          created_at,
          projects(id, name, cost_center),
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('billing_supports')
        .select(`
          id,
          project_id,
          user_id,
          client_name,
          cut_period_start,
          cut_period_end,
          delivered_ml,
          delivered_m2,
          amount_to_bill,
          acta_number,
          approver_client_name,
          notes,
          status,
          created_at,
          projects(id, name, cost_center),
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false })
    ]);

    const invoices = invoicesRes.data ?? [];
    const billingSupports = supportsRes.data ?? [];

    const pendingInvoices = invoices.filter((inv) => inv.payment_status !== 'paid' && inv.status !== 'rejected');
    const totalPayablesCOP = pendingInvoices.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

    const pendingBilling = billingSupports.filter((b) => b.status === 'ready_to_invoice');
    const totalReceivablesCOP = pendingBilling.reduce((acc, curr) => acc + (Number(curr.amount_to_bill) || 0), 0);

    const stats = {
      totalPayablesCOP,
      pendingInvoicesCount: pendingInvoices.length,
      totalReceivablesCOP,
      pendingBillingActasCount: pendingBilling.length,
    };

    return NextResponse.json({
      data: {
        stats,
        invoices,
        billingSupports,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
