import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getValidUserUuid(token: { userId?: string; email?: string | null; sub?: string }): Promise<string | null> {
  // 1. Probar userId si es UUID válido
  if (token.userId && UUID_REGEX.test(token.userId)) {
    return token.userId;
  }
  // 2. Si no, buscar el id UUID en la tabla users por email
  if (token.email) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', token.email)
      .maybeSingle();

    if (data?.id && UUID_REGEX.test(data.id)) {
      return data.id;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || (token.role !== 'dibujo' && token.role !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = await getValidUserUuid(token);

  if (!userId) {
    return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 400 });
  }

  const body = await req.json();

  const payload = {
    project_name: body.project_name,
    activity_date: body.activity_date,
    responsible: body.responsible || token.email || token.name || '',
    software: body.software,
    hours_worked: body.hours_worked ?? 9,
    is_rework: body.is_rework ?? false,
    elaboration_stage: body.elaboration_stage || null,
    other_software_name: body.other_software_name || null,
    rework_observations: body.rework_observations || null,
    user_id: userId,
  };

  const { error } = await supabase.from('drawing_activities').insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (token.role !== 'dibujo' && token.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const userId = await getValidUserUuid(token);

  let query = supabase
    .from('drawing_activities')
    .select('*')
    .order('activity_date', { ascending: false });

  if (token.role === 'dibujo' && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
