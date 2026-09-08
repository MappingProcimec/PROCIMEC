import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createAdminClient } from '@/lib/supabase';
import { isKnownAdmin } from '@/lib/admin-emails';
import type { FieldTrip } from '@/types';

// Helper to get local date in Colombia (UTC-5) format YYYY-MM-DD
function getTodayColombiaDate(): string {
  const now = new Date();
  // Adjust for Colombia UTC-5
  const colombiaOffset = -5 * 60;
  const localTime = new Date(now.getTime() + (colombiaOffset - now.getTimezoneOffset()) * 60000);
  return localTime.toISOString().split('T')[0];
}

async function getUserFromToken(token: { email?: string | null; role?: string; userId?: string }) {
  const supabase = createAdminClient();
  let role = token.role;
  let userId = token.userId;

  if (token.email) {
    if (isKnownAdmin(token.email)) {
      role = 'admin';
    }
    const { data } = await supabase
      .from('users')
      .select('id, role, full_name, email')
      .eq('email', token.email)
      .maybeSingle();

    if (data) {
      if (!isKnownAdmin(token.email)) {
        role = data.role;
      }
      userId = data.id;
      return { user: data, role, userId };
    }
  }

  return { user: null, role, userId };
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { role, userId } = await getUserFromToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Usuario no registrado en el sistema' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const targetUserId = (role === 'admin' && searchParams.get('userId')) ? searchParams.get('userId') : userId;

  const todayStr = getTodayColombiaDate();
  const supabase = createAdminClient();

  try {
    // 1. Obtener registro de hoy para el usuario actual
    const { data: todayData, error: todayErr } = await supabase
      .from('attendance_records')
      .select('*, users(id, full_name, email, role)')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();

    if (todayErr && todayErr.code !== 'PGRST116') {
      if (todayErr.message.includes('attendance_records')) {
        return NextResponse.json({
          error: 'La tabla de asistencia no existe aún en la base de datos. Ejecuta la migración 006.',
          needsMigration: true,
        }, { status: 503 });
      }
      throw todayErr;
    }

    // 2. Obtener historial en el rango solicitado
    let historyQuery = supabase
      .from('attendance_records')
      .select('*, users(id, full_name, email, role)')
      .order('date', { ascending: false });

    if (targetUserId) {
      historyQuery = historyQuery.eq('user_id', targetUserId);
    }

    if (startDate) {
      historyQuery = historyQuery.gte('date', startDate);
    }

    if (endDate) {
      historyQuery = historyQuery.lte('date', endDate);
    }

    const { data: historyData, error: historyErr } = await historyQuery.limit(100);

    if (historyErr) {
      throw historyErr;
    }

    return NextResponse.json({
      today: todayData ?? null,
      history: historyData ?? [],
      currentDate: todayStr,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al consultar asistencia';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { userId } = await getUserFromToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 400 });
  }

  const body = await req.json();
  const { action, location, is_office, destination, notes } = body;

  const todayStr = getTodayColombiaDate();
  const nowIso = new Date().toISOString();
  const supabase = createAdminClient();

  try {
    if (action === 'check_in') {
      // Registrar entrada
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, check_in_time')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle();

      if (existing?.check_in_time) {
        return NextResponse.json({ error: 'Ya has registrado tu entrada para el día de hoy.' }, { status: 400 });
      }

      const payload = {
        user_id: userId,
        date: todayStr,
        check_in_time: nowIso,
        check_in_location: location || 'Ubicación no disponible',
        check_in_is_office: Boolean(is_office),
        status: 'checked_in',
        notes: notes || null,
        field_trips: [],
      };

      const { data, error } = await supabase
        .from('attendance_records')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, record: data }, { status: 200 });
    }

    if (action === 'field_trip') {
      // Registrar salida a campo / obra durante la jornada
      if (!destination?.trim()) {
        return NextResponse.json({ error: 'Debes indicar el destino u obra de la visita técnica.' }, { status: 400 });
      }

      const { data: record, error: findErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!record || !record.check_in_time) {
        return NextResponse.json({ error: 'Debes registrar primero tu entrada antes de marcar una salida a campo.' }, { status: 400 });
      }

      if (record.check_out_time) {
        return NextResponse.json({ error: 'La jornada de hoy ya fue finalizada.' }, { status: 400 });
      }

      const newTrip: FieldTrip = {
        id: crypto.randomUUID(),
        time: nowIso,
        destination: destination.trim(),
        location: location || 'Ubicación GPS registrada',
        notes: notes || undefined,
      };

      const existingTrips = Array.isArray(record.field_trips) ? record.field_trips : [];
      const updatedTrips = [...existingTrips, newTrip];

      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          field_trips: updatedTrips,
          status: 'field_trip',
        })
        .eq('id', record.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, record: data, trip: newTrip }, { status: 200 });
    }

    if (action === 'check_out') {
      // Registrar salida de jornada
      const { data: record, error: findErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!record || !record.check_in_time) {
        return NextResponse.json({ error: 'No has registrado entrada hoy para poder marcar la salida.' }, { status: 400 });
      }

      if (record.check_out_time) {
        return NextResponse.json({ error: 'Ya has registrado tu salida el día de hoy.' }, { status: 400 });
      }

      // Calcular horas trabajadas
      const checkInMs = new Date(record.check_in_time).getTime();
      const checkOutMs = new Date(nowIso).getTime();
      const diffHours = Math.max(0, parseFloat(((checkOutMs - checkInMs) / (1000 * 60 * 60)).toFixed(2)));

      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: nowIso,
          check_out_location: location || 'Ubicación no disponible',
          check_out_is_office: Boolean(is_office),
          total_hours: diffHours,
          status: 'completed',
          notes: notes ? (record.notes ? `${record.notes} | ${notes}` : notes) : record.notes,
        })
        .eq('id', record.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, record: data, hoursWorked: diffHours }, { status: 200 });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al procesar asistencia';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
