import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Validar permisos: comercial, admin, gerencia, dibujo/costos o asignación en user_tools
  let hasAccess = [
    'admin',
    'commercial',
    'comercial',
    'management',
    'gerencia',
    'drawing',
    'dibujo',
  ].includes(userRole);

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
    const [oppsRes, budgetsRes, proposalsRes, closingsRes, projectsRes] = await Promise.all([
      // 1. Oportunidades
      supabase
        .from('commercial_opportunities')
        .select(`
          id,
          consecutive_number,
          opportunity_code,
          user_id,
          created_by_name,
          created_by_email,
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

      // 2. Presupuestos APU (commercial_budgets)
      supabase
        .from('commercial_budgets')
        .select(`
          id,
          consecutive_number,
          budget_code,
          opportunity_id,
          created_by_user_id,
          created_by_name,
          created_by_email,
          client_name,
          project_title,
          service_category,
          direct_cost_materials,
          direct_cost_equipment,
          direct_cost_labor,
          direct_cost_logistics,
          total_direct_cost,
          aiu_percentage,
          suggested_sale_price,
          items_detail,
          status,
          notes,
          created_at,
          updated_at,
          users:created_by_user_id(id, full_name, email),
          commercial_opportunities(opportunity_code, opportunity_title, client_name)
        `)
        .order('created_at', { ascending: false }),

      // 3. Cotizaciones (commercial_proposals)
      supabase
        .from('commercial_proposals')
        .select(`
          id,
          consecutive_number,
          opportunity_id,
          budget_id,
          project_id,
          user_id,
          created_by_name,
          created_by_email,
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
          commercial_opportunities(opportunity_code, opportunity_title, service_type),
          commercial_budgets(budget_code, total_direct_cost, suggested_sale_price),
          projects(id, code, cost_center, name)
        `)
        .order('created_at', { ascending: false }),

      // 4. Cierres Comerciales (commercial_closings)
      supabase
        .from('commercial_closings')
        .select(`
          id,
          consecutive_number,
          closing_code,
          opportunity_id,
          proposal_id,
          budget_id,
          user_id,
          created_by_name,
          created_by_email,
          closing_type,
          result,
          final_value,
          final_contract_value,
          contract_number,
          reason,
          loss_reason,
          feedback_notes,
          closing_notes,
          project_code,
          created_at,
          users(id, full_name, email),
          commercial_proposals(quote_code, client_name, total_amount)
        `)
        .order('created_at', { ascending: false }),

      // 5. Proyectos Oficiales (projects) con vinculación a cotizaciones
      supabase
        .from('projects')
        .select(`
          id,
          code,
          cost_center,
          name,
          client,
          location,
          contract_number,
          contract_value,
          execution_value,
          deductions_percentage,
          deductions_amount,
          commercial_proposal_id,
          commercial_closing_id,
          commercial_budget_id,
          is_active,
          created_at,
          commercial_proposal:commercial_proposal_id(quote_code, client_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const opportunities = (oppsRes.data ?? []).map((o) => ({
      ...o,
      opportunity_code: o.opportunity_code || `OPP-${o.consecutive_number || '001'}`,
    }));

    // Si commercial_budgets aún no existe en Supabase (error 42P01), devolvemos array vacío de forma resiliente
    const budgets = (budgetsRes.error?.code === '42P01' ? [] : (budgetsRes.data ?? [])).map((b) => ({
      ...b,
      budget_code: b.budget_code || `PRE-${b.consecutive_number || '001'}`,
    }));

    const proposals = proposalsRes.data ?? [];
    const closings = (closingsRes.data ?? []).map((c) => ({
      ...c,
      closing_code: c.closing_code || `CIE-${c.consecutive_number || '001'}`,
      result: c.result || c.closing_type || 'won',
      final_contract_value: c.final_contract_value || c.final_value || 0,
    }));

    const projects = projectsRes.data ?? [];

    const activePipeline = opportunities.filter((o) => ['open', 'quoted', 'in_negotiation'].includes(o.status));
    const totalPipelineCOP = activePipeline.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0);
    const wonClosings = closings.filter((c) => c.result === 'won' || c.closing_type === 'won' || c.closing_type === 'adjudicada');
    const totalWonCOP = wonClosings.reduce((acc, curr) => acc + (Number(curr.final_contract_value) || 0), 0);
    const totalEvaluatedClosings = closings.length;
    const winRate = totalEvaluatedClosings > 0 ? Math.round((wonClosings.length / totalEvaluatedClosings) * 100) : 0;

    const stats = {
      pipelineCOP: totalPipelineCOP,
      activeOpportunitiesCount: activePipeline.length,
      budgetsCount: budgets.length,
      issuedProposalsCount: proposals.length,
      wonContractsCOP: totalWonCOP,
      winRatePct: winRate,
    };

    return NextResponse.json({
      data: {
        stats,
        opportunities,
        budgets,
        proposals,
        closings,
        projects,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/tools/commercial-pipeline - Vinculación bidireccional retroactiva
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { action, proposal_id, project_id } = body;

  if (action !== 'link_proposal_project') {
    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  }

  if (!proposal_id || !project_id) {
    return NextResponse.json({ error: 'Se requiere proposal_id y project_id' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Vincular propuesta al proyecto
    await supabase
      .from('commercial_proposals')
      .update({ project_id })
      .eq('id', proposal_id);

    // 2. Vincular proyecto a la propuesta
    await supabase
      .from('projects')
      .update({ commercial_proposal_id: proposal_id })
      .eq('id', project_id);

    return NextResponse.json({ success: true, message: 'Vinculación bidireccional exitosa' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al vincular';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
