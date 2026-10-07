import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDateToIso(dateStr?: string | null): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Si viene en formato DD/MM/YYYY
  const parts = trimmed.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return trimmed;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { count } = await supabase
      .from('commercial_opportunities')
      .select('*', { count: 'exact', head: true });

    const currentYear = new Date().getFullYear();
    const nextNumber = (count || 0) + 1;
    const nextCode = `OPP-${currentYear}-${String(nextNumber).padStart(3, '0')}`;

    return NextResponse.json({
      data: {
        nextCode,
        nextNumber,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al obtener consecutivo de oportunidad';
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

  // 1. Obtener usuario autenticado en BD
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('email', session.user.email)
    .single();

  if (userError || !dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
  }

  const {
    opportunity_title,
    client_name,
    client_contact,
    client_email,
    client_phone,
    service_type,
    estimated_value,
    deadline_date,
    location,
    notes,
  } = body;

  if (!opportunity_title?.trim() || !client_name?.trim()) {
    return NextResponse.json(
      { error: 'El nombre de la oportunidad y el cliente son campos obligatorios.' },
      { status: 400 }
    );
  }

  try {
    const { count } = await supabase
      .from('commercial_opportunities')
      .select('*', { count: 'exact', head: true });

    const consecutiveNum = (count || 0) + 1;
    const year = new Date().getFullYear();
    const oppCode = `OPP-${year}-${String(consecutiveNum).padStart(3, '0')}`;

    const oppPayload: Record<string, unknown> = {
      user_id: dbUser.id,
      consecutive_number: consecutiveNum,
      opportunity_code: oppCode,
      created_by_name: dbUser.full_name || session.user.name || 'Comercial',
      created_by_email: dbUser.email || session.user.email,
      opportunity_title: String(opportunity_title).trim(),
      client_name: String(client_name).trim(),
      client_contact: client_contact ? String(client_contact).trim() : null,
      client_email: client_email ? String(client_email).trim() : null,
      client_phone: client_phone ? String(client_phone).trim() : null,
      service_type: service_type || 'gpr_localizacion',
      estimated_value: estimated_value ? Number(estimated_value) : null,
      deadline_date: parseDateToIso(deadline_date),
      location: location ? String(location).trim() : null,
      notes: notes ? String(notes).trim() : null,
      status: 'open',
    };

    let { data, error } = await supabase
      .from('commercial_opportunities')
      .insert(oppPayload)
      .select()
      .single();

    // Reintento 1: Si faltan columnas de enriquecimiento en esquemas anteriores
    if (error && error.code === '42703') {
      delete oppPayload.consecutive_number;
      delete oppPayload.opportunity_code;
      delete oppPayload.created_by_name;
      delete oppPayload.created_by_email;
      const retry = await supabase.from('commercial_opportunities').insert(oppPayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    // Reintento 2: Si el CHECK constraint de la base de datos restringe líneas nuevas (ej. civil_planta)
    if (error && (error.code === '23514' || String(error.message || '').includes('check constraint'))) {
      const originalService = String(oppPayload.service_type);
      oppPayload.service_type = 'consultoria'; // Línea universal permitida en el constraint original
      oppPayload.notes = `[Línea Solicitada: ${originalService}] ${oppPayload.notes || ''}`.trim();
      const retryCheck = await supabase.from('commercial_opportunities').insert(oppPayload).select().single();
      data = retryCheck.data;
      error = retryCheck.error;
    }

    if (error) {
      console.error('Error insertando commercial_opportunities:', error);
      const detail = error.message || error.details || 'Error en base de datos';
      return NextResponse.json({ error: `No fue posible guardar la oportunidad: ${detail}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Oportunidad comercial registrada exitosamente',
      data,
    });
  } catch (err: unknown) {
    console.error('Error no controlado en POST /api/forms/registro-oportunidad:', err);
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
