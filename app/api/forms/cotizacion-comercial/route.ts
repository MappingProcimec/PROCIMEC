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
      .from('commercial_proposals')
      .select('*', { count: 'exact', head: true });

    const currentYear = new Date().getFullYear();
    const nextNumber = (count || 0) + 1;
    const nextCode = `COT-${currentYear}-${String(nextNumber).padStart(3, '0')}`;

    return NextResponse.json({
      data: {
        nextCode,
        nextNumber,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al obtener consecutivo de cotización';
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
    client_name,
    scope_description,
    subtotal,
    tax_amount,
    total_amount,
    validity_days,
    delivery_weeks,
    notes,
    opportunity_id,
    budget_id,
    project_id,
  } = body;

  if (!quote_code?.trim() || !client_name?.trim()) {
    return NextResponse.json(
      { error: 'El código de cotización y el cliente son campos obligatorios.' },
      { status: 400 }
    );
  }

  try {
    const { count } = await supabase
      .from('commercial_proposals')
      .select('*', { count: 'exact', head: true });

    const consecutiveNum = (count || 0) + 1;

    const proposalPayload: Record<string, unknown> = {
      user_id: dbUser.id,
      consecutive_number: consecutiveNum,
      opportunity_id: opportunity_id || null,
      budget_id: budget_id || null,
      project_id: project_id || null,
      created_by_name: dbUser.full_name || session.user.name || 'Comercial',
      created_by_email: dbUser.email || session.user.email,
      quote_code: String(quote_code).trim().toUpperCase(),
      client_name: String(client_name).trim(),
      scope_description: String(scope_description || '').trim(),
      subtotal: Number(subtotal) || 0,
      tax_amount: Number(tax_amount) || 0,
      total_amount: Number(total_amount) || (Number(subtotal) || 0),
      validity_days: Number(validity_days) || 30,
      delivery_weeks: Number(delivery_weeks) || 2,
      notes: notes ? String(notes).trim() : null,
    };

    let { data, error } = await supabase
      .from('commercial_proposals')
      .insert(proposalPayload)
      .select()
      .single();

    if (error && (error.code === '42703' || String(error.message || '').includes('schema cache'))) {
      delete proposalPayload.consecutive_number;
      delete proposalPayload.budget_id;
      delete proposalPayload.project_id;
      delete proposalPayload.created_by_name;
      delete proposalPayload.created_by_email;

      const retry = await supabase.from('commercial_proposals').insert(proposalPayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error insertando en commercial_proposals:', error);
      const detail = error.message || error.details || 'Error en base de datos';
      return NextResponse.json({ error: `No fue posible guardar la cotización: ${detail}` }, { status: 500 });
    }

    // Vinculación bidireccional si se seleccionó un proyecto existente
    if (project_id && data?.id) {
      try {
        await supabase
          .from('projects')
          .update({ commercial_proposal_id: data.id })
          .eq('id', project_id);
      } catch (linkErr) {
        console.warn('No se pudo actualizar commercial_proposal_id en projects:', linkErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cotización comercial registrada exitosamente.',
      data,
    });
  } catch (err: unknown) {
    console.error('Error no controlado en POST /api/forms/cotizacion-comercial:', err);
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
