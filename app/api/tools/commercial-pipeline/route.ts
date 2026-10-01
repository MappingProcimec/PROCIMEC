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

  // Validar permisos: rol comercial, admin, gerencia o asignación en user_tools
  let hasAccess = userRole === 'admin' || userRole === 'commercial' || userRole === 'comercial' || userRole === 'management' || userRole === 'gerencia';
  if (!hasAccess && userId) {
    try {
      const { data: ut } = await supabase
        .from('user_tools')
        .select('tools!inner(slug)')
        .eq('user_id', userId)
        .eq('tools.slug', 'commercial-pipeline')
        .maybeSingle();

      if (ut) hasAccess = true;
    } catch {
      // Ignorar si la tabla no responde
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'No tienes permisos para consultar la Gestión Comercial.' },
      { status: 403 }
    );
  }

  try {
    const [oppsRes, proposalsRes, closingsRes] = await Promise.all([
      supabase
        .from('commercial_opportunities')
        .select(`
          id,
          user_id,
          client_name,
          client_contact,
          client_email,
          client_phone,
          opportunity_title,
          service_type,
          estimated_value,
          deadline_date,
          location,
          notes,
          status,
          created_at,
          users(id, full_name, email)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('commercial_proposals')
        .select(`
          id,
          opportunity_id,
          user_id,
          quote_code,
          client_name,
          scope_description,
          subtotal,
          tax_amount,
          total_amount,
          validity_days,
          delivery_weeks,
          notes,
          created_at,
          users(id, full_name, email),
          commercial_opportunities(opportunity_title, service_type)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('commercial_closings')
        .select(`
          id,
          proposal_id,
          user_id,
          closing_type,
          final_value,
          reason,
          feedback_notes,
          project_code,
          created_at,
          users(id, full_name, email),
          commercial_proposals(quote_code, client_name)
        `)
        .order('created_at', { ascending: false })
    ]);

    const opportunities = oppsRes.data ?? [];
    const proposals = proposalsRes.data ?? [];
    const closings = closingsRes.data ?? [];

    const activePipeline = opportunities.filter((o) => ['open', 'quoted', 'in_negotiation'].includes(o.status));
    const totalPipelineCOP = activePipeline.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0);
    const wonClosings = closings.filter((c) => c.closing_type === 'won' || c.closing_type === 'adjudicada');
    const totalWonCOP = wonClosings.reduce((acc, curr) => acc + (Number(curr.final_value) || 0), 0);
    const totalEvaluatedClosings = closings.length;
    const winRate = totalEvaluatedClosings > 0 ? Math.round((wonClosings.length / totalEvaluatedClosings) * 100) : 0;

    const stats = {
      pipelineCOP: totalPipelineCOP,
      activeOpportunitiesCount: activePipeline.length,
      issuedProposalsCount: proposals.length,
      wonContractsCOP: totalWonCOP,
      winRatePct: winRate,
    };

    return NextResponse.json({
      data: {
        stats,
        opportunities,
        proposals,
        closings,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
