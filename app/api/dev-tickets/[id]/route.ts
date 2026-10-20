import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { UpdateTicketStatusSchema, ReformulateTicketSchema } from '@/lib/dev-tickets/schemas';
import { generateDevTicketSpec } from '@/lib/dev-tickets/spec-generator';
import { FeedbackEntry } from '@/lib/dev-tickets/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: ticket, error: ticketError } = await supabase
      .from('dev_tickets')
      .select('*, user:users(id, email, role, nick_name)')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    const { data: logs } = await supabase
      .from('dev_ticket_logs')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      data: {
        ...ticket,
        logs: logs || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const isAdmin = ['admin', 'gerencia', 'management'].includes(session.user.role || '') || 
                    session.user.email?.includes('procimec');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Solo administradores pueden modificar el estado' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const supabase = createAdminClient();

    // Obtener ticket actual
    const { data: currentTicket, error: fetchError } = await supabase
      .from('dev_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentTicket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    // Caso A: Reformulación de plan con observaciones
    if (body?.action === 'reformulate') {
      const parsed = ReformulateTicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Observaciones no válidas', details: parsed.error.issues }, { status: 400 });
      }

      const existingHistory: FeedbackEntry[] = Array.isArray(currentTicket.feedback_history) 
        ? currentTicket.feedback_history 
        : [];

      const newEntry: FeedbackEntry = {
        author: 'admin',
        message: parsed.data.feedback,
        timestamp: new Date().toISOString(),
        version: existingHistory.length + 1,
      };

      const updatedHistory = [...existingHistory, newEntry];

      // Regenerar plan técnico incorporando el feedback
      const newSpec = await generateDevTicketSpec({
        title: currentTicket.title,
        description: currentTicket.description,
        contextUrl: currentTicket.context_url,
        feedbackHistory: updatedHistory,
      });

      const { data: updated, error: updateError } = await supabase
        .from('dev_tickets')
        .update({
          technical_spec: newSpec,
          feedback_history: updatedHistory,
          status: 'awaiting_approval',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await supabase.from('dev_ticket_logs').insert({
        ticket_id: id,
        stage: 'reformulated',
        message: `Plan técnico reformulado (v${updatedHistory.length}): "${parsed.data.feedback}"`,
      });

      return NextResponse.json({ success: true, data: updated });
    }

    // Caso B: Actualización directa de estado (aprobar, cancelar, etc.)
    const parsed = UpdateTicketStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos no válidos', details: parsed.error.issues }, { status: 400 });
    }

    const { status, commitHash, errorMessage } = parsed.data;

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (commitHash) updatePayload.commit_hash = commitHash;
    if (errorMessage) updatePayload.error_message = errorMessage;

    const { data: updated, error: updateError } = await supabase
      .from('dev_tickets')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from('dev_ticket_logs').insert({
      ticket_id: id,
      stage: `status_${status}`,
      message: `Estado cambiado a ${status} por ${session.user.email || 'admin'}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
