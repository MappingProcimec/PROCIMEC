import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { CreateTicketSchema } from '@/lib/dev-tickets/schemas';
import { generateDevTicketSpec } from '@/lib/dev-tickets/spec-generator';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const isAdmin = ['admin', 'gerencia', 'management'].includes(session.user.role || '') || 
                    session.user.email?.includes('procimec');

    let query = supabase
      .from('dev_tickets')
      .select('*, user:users(id, email, role, nick_name)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', session.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[dev-tickets GET] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos no válidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { title, description, contextUrl } = parsed.data;
    const supabase = createAdminClient();

    // 1. Insertar ticket en estado inicial 'pending_spec'
    const { data: ticket, error: insertError } = await supabase
      .from('dev_tickets')
      .insert({
        user_id: session.user.id,
        title,
        description,
        context_url: contextUrl || null,
        status: 'pending_spec',
        technical_spec: {},
        feedback_history: [],
      })
      .select()
      .single();

    if (insertError || !ticket) {
      console.error('[dev-tickets POST] Error al insertar ticket:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Error al guardar' }, { status: 500 });
    }

    // Registrar log inicial
    await supabase.from('dev_ticket_logs').insert({
      ticket_id: ticket.id,
      stage: 'created',
      message: `Ticket creado por ${session.user.email || session.user.name || 'usuario'}`,
    });

    // 2. Generar Especificación Técnica con IA
    const spec = await generateDevTicketSpec({
      title,
      description,
      contextUrl,
    });

    // 3. Actualizar a 'awaiting_approval' con el plan generado
    const { data: updatedTicket, error: updateError } = await supabase
      .from('dev_tickets')
      .update({
        technical_spec: spec,
        status: 'awaiting_approval',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select('*, user:users(id, email, role, nick_name)')
      .single();

    if (updateError) {
      console.error('[dev-tickets POST] Error actualizando especificación:', updateError);
    }

    await supabase.from('dev_ticket_logs').insert({
      ticket_id: ticket.id,
      stage: 'spec_generated',
      message: 'Plan técnico generado por IA y enviado a espera de aprobación',
      metadata: spec as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      success: true,
      data: updatedTicket || ticket,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[dev-tickets POST] Error general:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
