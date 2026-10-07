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

  const supabase = createAdminClient();

  try {
    const { count } = await supabase
      .from('commercial_closings')
      .select('*', { count: 'exact', head: true });

    const currentYear = new Date().getFullYear();
    const nextNumber = (count || 0) + 1;
    const nextCode = `CIE-${currentYear}-${String(nextNumber).padStart(3, '0')}`;

    return NextResponse.json({
      data: {
        nextCode,
        nextNumber,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al obtener consecutivo de cierre';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // 1. Obtener usuario en BD
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('email', session.user.email)
    .single();

  if (userError || !dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
  }

  const {
    quote_code,
    proposal_id,
    result: closingResult,
    final_contract_value,
    contract_number,
    loss_reason,
    closing_notes,
    opportunity_id,
    budget_id,
  } = body;

  if (!quote_code?.trim() || !closingResult) {
    return NextResponse.json(
      { error: 'El código de cotización y el resultado del cierre son obligatorios.' },
      { status: 400 }
    );
  }

  try {
    const { count } = await supabase
      .from('commercial_closings')
      .select('*', { count: 'exact', head: true });

    const consecutiveNum = (count || 0) + 1;
    const year = new Date().getFullYear();
    const closingCode = `CIE-${year}-${String(consecutiveNum).padStart(3, '0')}`;

    // Buscar proposal_id y antecedentes si no vienen en el payload
    let resolvedProposalId = proposal_id || null;
    let resolvedOppId = opportunity_id || null;
    let resolvedBudgetId = budget_id || null;

    if (!resolvedProposalId && quote_code) {
      const { data: prop } = await supabase
        .from('commercial_proposals')
        .select('id, opportunity_id, budget_id')
        .eq('quote_code', quote_code.trim().toUpperCase())
        .maybeSingle();

      if (prop) {
        resolvedProposalId = prop.id;
        resolvedOppId = prop.opportunity_id;
        resolvedBudgetId = prop.budget_id;
      }
    }

    // Payload canónico estricto según columnas existentes en public.commercial_closings
    const closingPayload: Record<string, unknown> = {
      user_id: dbUser.id,
      consecutive_number: consecutiveNum,
      closing_code: closingCode,
      proposal_id: resolvedProposalId,
      opportunity_id: resolvedOppId,
      budget_id: resolvedBudgetId,
      created_by_name: dbUser.full_name || session.user.name || 'Comercial',
      created_by_email: dbUser.email || session.user.email,
      result: closingResult,
      final_contract_value: closingResult === 'won' && final_contract_value ? Number(final_contract_value) : null,
      contract_number: closingResult === 'won' && contract_number ? String(contract_number).trim() : null,
      loss_reason: closingResult !== 'won' && loss_reason ? String(loss_reason).trim() : null,
      closing_notes: closing_notes ? String(closing_notes).trim() : null,
    };

    let { data, error } = await supabase
      .from('commercial_closings')
      .insert(closingPayload)
      .select()
      .single();

    // Reintento: si la base de datos no tiene aún las columnas añadidas en migraciones recientes
    if (error && (error.code === '42703' || String(error.message || '').includes('schema cache'))) {
      delete closingPayload.consecutive_number;
      delete closingPayload.closing_code;
      delete closingPayload.budget_id;
      delete closingPayload.created_by_name;
      delete closingPayload.created_by_email;

      const retry = await supabase.from('commercial_closings').insert(closingPayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error insertando en commercial_closings:', error);
      const detail = error.message || error.details || 'Error en base de datos';
      return NextResponse.json({ error: `No fue posible guardar el cierre: ${detail}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Cierre de negociación registrado exitosamente.',
      data,
    });
  } catch (err: unknown) {
    console.error('Error no controlado en POST /api/forms/cierre-comercial:', err);
    let message = 'Error interno al procesar el formulario';
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'object' && err !== null) {
      const pg = err as { message?: string; details?: string };
      if (pg.message) message = `${pg.message}${pg.details ? ` (${pg.details})` : ''}`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
